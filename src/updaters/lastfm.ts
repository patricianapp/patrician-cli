import { CliConfig, Collection, Identifier, Item, ItemUpdates, SingleItemUpdates } from '../types';
import LastFm from '@toplast/lastfm';
import { IAlbum } from '@toplast/lastfm/lib/common/common.interface';
import fs from 'fs';
import { createAmazonFilter, MetadataFilter } from 'metadata-filter';

export function updateItemInPlaceIfMatching(sourceItem: IAlbum, collectionItem: Item): SingleItemUpdates | null {
	let matchingIdentifier: Identifier['idType'];
	const oldData: Partial<Item> = {};
	const newData: Partial<Item> = {};

	if (!sourceItem.artist) {
		return null;
	}

	if (
		sourceItem.artist &&
		sourceItem.artist.name &&
		sourceItem.name &&
		sourceItem.artist.name.toLowerCase() === collectionItem.Artist.toLowerCase() &&
		sourceItem.name.toLowerCase() === collectionItem.Title.toLowerCase()
	) {
		matchingIdentifier = 'artist-title';
		newData.MBID = sourceItem.mbid;
	} else if (sourceItem.mbid === collectionItem.MBID) {
		matchingIdentifier = 'mbid';
	} else {
		return null;
	}

	newData.Plays = sourceItem.playcount;
	for (const [field, value] of Object.entries(newData)) {
		collectionItem[field as keyof Item] = value;
	}

	return {
		matchingIdentifier,
		identifiers: [
			{
				idType: 'artist-title',
				value: `${sourceItem.artist.name} - ${sourceItem.name}`,
			},
			{
				idType: 'mbid',
				value: sourceItem.mbid,
			},
		],
		source: 'lastfm',
		oldData,
		newData,
	};
}

export function newItem(sourceItem: IAlbum): Item {
	const { mbid, artist, playcount, name } = sourceItem;
	return {
		Artist: artist?.name ?? '',
		Title: name ?? '',
		MBID: mbid,
		Plays: playcount,
	};
}

export class LastFmUpdater {
	private lastfmConfig: CliConfig['sources']['lastfm'];
	private itemUpdates: ItemUpdates;
	private metadataFilter: MetadataFilter;

	constructor(config: CliConfig, private collection: Collection) {
		this.lastfmConfig = config.sources.lastfm;
		this.itemUpdates = {
			newItems: [],
			updatedItems: [],
		};
		this.metadataFilter = createAmazonFilter();
	}

	async update(): Promise<{ itemUpdates: ItemUpdates }> {
		const lastFm = new LastFm(this.lastfmConfig.apiKey);

		let continueFetching = true;
		let page = 1;
		while (continueFetching) {
			// const albums = await lastFm.user.getTopAlbums({ user: this.lastfmConfig.username, page });
			const albums = {
				// Use cache for testing
				topalbums: {
					album: JSON.parse(fs.readFileSync('lastfm-albums').toString()) as Array<IAlbum>,
				},
			};

			// console.log(albums.topalbums['@attr']);
			let singleItemUpdates: SingleItemUpdates | null = null;
			for (const album of albums.topalbums.album) {
				if (album.name) {
					album.name = this.metadataFilter.filterField('album', album.name).trim();
				}
				for (const collectionItem of this.collection) {
					singleItemUpdates = updateItemInPlaceIfMatching(album, collectionItem);
					if (singleItemUpdates !== null) {
						break;
					}
				}
				if (singleItemUpdates) {
					this.itemUpdates.updatedItems.push(singleItemUpdates);
				} else {
					this.collection.push(newItem(album));
					this.itemUpdates.newItems.push(newItem(album));
				}
				if (Number(album.playcount) < this.lastfmConfig.playsThreshold) {
					continueFetching = false;
				}
			}
			page++;
		}

		return { itemUpdates: this.itemUpdates };
	}
}
