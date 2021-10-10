import { CliConfig, Collection, Identifier, Item, ItemDiff, SingleItemUpdates, ItemUpdates } from '../types';
import csvParse from 'csv-parse';
import fs from 'fs';

interface RYMItem {
	'RYM Album': string;
	'First Name': string;
	'Last Name': string;
	'First Name localized': string;
	'Last Name localized': string;
	Title: string;
	Release_Date: string;
	Rating: string;
	Ownership: string;
	'Purchase Date': string;
	'Media Type': string;
	Review: string;
}

export function doesItemMatch(sourceItem: RYMItem, collectionItem: Item) {
	const sourceArtist = sourceItem['First Name']
		? `${sourceItem['First Name']} ${sourceItem['Last Name']}`
		: sourceItem['Last Name'];

	return (
		sourceItem['RYM Album'] === collectionItem.RYMID ||
		(sourceArtist === collectionItem.Artist && sourceItem.Title === collectionItem.Title)
	);
}

export function updateItemInPlaceIfMatching(sourceItem: RYMItem, collectionItem: Item): SingleItemUpdates | null {
	const sourceArtist = sourceItem['First Name']
		? `${sourceItem['First Name']} ${sourceItem['Last Name']}`
		: sourceItem['Last Name'];

	let matchingIdentifier: Identifier['idType'];
	const oldData: Partial<Item> = {};
	const newData: Partial<Item> = {};

	if (
		sourceArtist.toLowerCase() === collectionItem.Artist.toLowerCase() &&
		sourceItem.Title.toLowerCase() === collectionItem.Title.toLowerCase()
	) {
		matchingIdentifier = 'artist-title';
		newData.RYMID = sourceItem['RYM Album'];
	} else if (sourceItem['RYM Album'] === collectionItem.RYMID) {
		matchingIdentifier = 'rymId';
	} else {
		return null;
	}

	if (sourceItem.Release_Date !== collectionItem.ReleaseDate) {
		oldData.ReleaseDate = collectionItem.ReleaseDate;
		newData.ReleaseDate = sourceItem.Release_Date;
	}
	if (sourceItem.Rating !== collectionItem.Rating) {
		oldData.Rating = collectionItem.Rating;
		newData.Rating = sourceItem.Rating;
	}

	// for now, just replace with new data
	for (let [field, value] of Object.entries(newData)) {
		collectionItem[field as keyof Item] = value;
	}

	return {
		matchingIdentifier,
		identifiers: [
			{
				idType: 'artist-title',
				value: `${sourceArtist} - ${sourceItem.Title}`,
			},
			{
				idType: 'rymId',
				value: sourceItem['RYM Album'],
			},
		],
		source: 'rym',
		oldData,
		newData,
	};
}

export function newItem(sourceItem: RYMItem): Item {
	const sourceArtist = sourceItem['First Name']
		? `${sourceItem['First Name']} ${sourceItem['Last Name']}`
		: sourceItem['Last Name'];
	return {
		Artist: sourceArtist,
		Title: sourceItem.Title,
		ReleaseDate: sourceItem.Release_Date,
		RYMID: sourceItem['RYM Album'],
		Rating: sourceItem.Rating,
	};
}

export class RYMUpdater {
	private rymFilename: string;
	private itemUpdates: ItemUpdates;

	constructor(config: CliConfig, private collection: Collection) {
		this.rymFilename = config.sources.rym.filename;
		this.itemUpdates = {
			newItems: [],
			updatedItems: [],
		};
	}

	async update(): Promise<{ itemUpdates: ItemUpdates }> {
		return new Promise((resolve, reject) => {
			const readStream = fs.createReadStream(this.rymFilename);
			const parser = csvParse({ columns: true, delimiter: ',', quote: '"', ltrim: true, rtrim: true });

			parser.on('readable', () => {
				let record: RYMItem;

				while ((record = parser.read() as RYMItem)) {
					let singleItemUpdates: SingleItemUpdates | null = null;

					for (const collectionItem of this.collection) {
						singleItemUpdates = updateItemInPlaceIfMatching(record, collectionItem);
						if (singleItemUpdates !== null) {
							break;
						}
					}

					if (singleItemUpdates) {
						this.itemUpdates.updatedItems.push(singleItemUpdates);
					} else {
						this.collection.push(newItem(record));
						this.itemUpdates.newItems.push(newItem(record));
					}
				}
			});

			parser.on('end', () => {
				resolve({ itemUpdates: this.itemUpdates });
			});
			readStream.pipe(parser);
		});
	}
}
