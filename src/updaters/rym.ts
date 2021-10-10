import { CliConfig, Collection, Item, ItemDiff, ItemUpdates } from '../types';
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

	private doesItemMatch(sourceItem: RYMItem, collectionItem: Item): boolean {
		const sourceArtist = sourceItem['First Name']
			? `${sourceItem['First Name']} ${sourceItem['Last Name']}`
			: sourceItem['Last Name'];
		return (
			sourceItem['RYM Album'] === collectionItem.RYMID ||
			(sourceArtist === collectionItem.Artist && sourceItem.Title === collectionItem.Title)
		);
	}

	private itemDiff(sourceItem: RYMItem, collectionItem: Item): ItemDiff {
		const isDateDifferent = sourceItem.Release_Date !== collectionItem.ReleaseDate;
		return {
			identifier: {
				idType: 'rymId',
				value: sourceItem['RYM Album'],
			},
			oldData: {
				ReleaseDate: isDateDifferent ? collectionItem.ReleaseDate : undefined,
			},
			newData: {
				ReleaseDate: isDateDifferent ? sourceItem.Release_Date : undefined,
			},
		};
	}

	private newItem(sourceItem: RYMItem): Item {
		const sourceArtist = sourceItem['First Name']
			? `${sourceItem['First Name']} ${sourceItem['Last Name']}`
			: sourceItem['Last Name'];
		return {
			Artist: sourceArtist,
			Title: sourceItem.Title,
			ReleaseDate: sourceItem.Release_Date,
			RYMID: sourceItem['RYM Album'],
		};
	}

	// Diffs source and collection file
	async fetchUpdates(): Promise<ItemUpdates> {
		return new Promise((resolve, reject) => {
			const readStream = fs.createReadStream(this.rymFilename);
			const parser = csvParse({ columns: true, delimiter: ',', quote: '"', ltrim: true, rtrim: true });

			parser.on('readable', () => {
				let record: RYMItem;
				while ((record = parser.read() as RYMItem)) {
					const matchingCollectionItem = this.collection.find((collectionItem) =>
						this.doesItemMatch(record, collectionItem)
					);
					if (matchingCollectionItem) {
						this.itemUpdates.updatedItems.push(this.itemDiff(record, matchingCollectionItem));
					} else {
						// console.log(record.Title);
						this.itemUpdates.newItems.push(this.newItem(record));
					}
				}
			});

			parser.on('end', () => {
				resolve(this.itemUpdates);
			});
			readStream.pipe(parser);
		});
	}
}
