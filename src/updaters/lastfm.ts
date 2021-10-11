import { CliConfig, Collection, FieldUpdate, Identifier, Item, ItemUpdates, SingleItemUpdates } from '../types';
import LastFm from '@toplast/lastfm';
import { IAlbum } from '@toplast/lastfm/lib/common/common.interface';
import fs from 'fs';
import { createAmazonFilter, MetadataFilter } from 'metadata-filter';
import inquirer, { CheckboxChoiceOptions } from 'inquirer';

export function getItemUpdates(sourceItem: IAlbum, collectionItem: Item): SingleItemUpdates | null {
	let matchingIdentifier: Identifier['idType'];
	const updates: Array<FieldUpdate> = [];

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
		collectionItem.MBID = sourceItem.mbid;
	} else if (sourceItem.mbid && sourceItem.mbid === collectionItem.MBID) {
		matchingIdentifier = 'mbid';
	} else {
		return null;
	}

	if (sourceItem.playcount && sourceItem.playcount !== collectionItem.Plays) {
		updates.push({
			field: 'Plays',
			oldValue: collectionItem.Plays,
			newValue: sourceItem.playcount,
		});
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
		updates,
		item: collectionItem,
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

export function updatedItemsCheckboxes(itemUpdates: Array<SingleItemUpdates>): Array<CheckboxChoiceOptions> {
	return itemUpdates.flatMap((itemUpdate) =>
		itemUpdate.updates.map((fieldUpdate) => ({
			name: `${itemUpdate.item.Artist} - ${itemUpdate.item.Title}: Update ${fieldUpdate.field} ${
				fieldUpdate.oldValue ? `from ${fieldUpdate.oldValue} ` : ''
			}to ${fieldUpdate.newValue}`,
			value: {
				...itemUpdate,
				updates: [fieldUpdate],
			},
		}))
	);
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
		console.log('Fetching top albums from Last.fm...');
		const lastFm = new LastFm(this.lastfmConfig.apiKey);

		let continueFetching = true;
		let page = 1;
		while (continueFetching) {
			console.log(page);
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
					singleItemUpdates = getItemUpdates(album, collectionItem);
					if (singleItemUpdates !== null) {
						break;
					}
				}
				if (singleItemUpdates) {
					this.itemUpdates.updatedItems.push(singleItemUpdates);
				} else {
					this.itemUpdates.newItems.push(newItem(album));
				}
				if (Number(album.playcount) < this.lastfmConfig.playsThreshold) {
					continueFetching = false;
				}
			}
			page++;
		}

		console.log(
			`Last.fm: Found ${this.itemUpdates.newItems.length} new albums, ${this.itemUpdates.updatedItems.length} updates.`
		);

		const promptResponses = await inquirer.prompt([
			{
				type: 'checkbox',
				name: 'import-albums-select',
				message: `\nSelect new albums to import:`,
				choices: this.itemUpdates.newItems.map((item) => ({
					name: `${item.Artist} - ${item.Title} (${item.Plays} plays)`,
					value: item,
				})),
				loop: false,
			},
			{
				type: 'checkbox',
				name: 'updates-select',
				message: `\nSelect updates to apply:`,
				choices: updatedItemsCheckboxes(this.itemUpdates.updatedItems),
				loop: false,
			},
		]);

		const newItemsToAdd = promptResponses['import-albums-select'];
		this.collection.push(...newItemsToAdd);

		const itemsToUpdate = promptResponses['updates-select'];
		for (const itemUpdate of itemsToUpdate) {
			const singleItemUpdate = itemUpdate as SingleItemUpdates;

			// Remember, each field update now exists in a separate singleItemUpdate due to the way updatedItemsCheckboxes() works
			const fieldUpdate = singleItemUpdate.updates[0];
			singleItemUpdate.item[fieldUpdate.field] = fieldUpdate.newValue;
		}

		return { itemUpdates: this.itemUpdates };
	}
}
