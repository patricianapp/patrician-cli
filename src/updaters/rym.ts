import { CliConfig, Collection, Identifier, Item, SingleItemUpdates, ItemUpdates, FieldUpdate } from '../types';
import csvParse from 'csv-parse';
import fs from 'fs';
import inquirer, { CheckboxChoiceOptions } from 'inquirer';

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

export function getItemUpdates(sourceItem: RYMItem, collectionItem: Item): SingleItemUpdates | null {
	const sourceArtist = sourceItem['First Name']
		? `${sourceItem['First Name']} ${sourceItem['Last Name']}`
		: sourceItem['Last Name'];

	let matchingIdentifier: Identifier['idType'];
	const updates: Array<FieldUpdate> = [];

	if (
		sourceArtist.toLowerCase() === collectionItem.Artist.toLowerCase() &&
		sourceItem.Title.toLowerCase() === collectionItem.Title.toLowerCase()
	) {
		matchingIdentifier = 'artist-title';
		collectionItem.RYMID = sourceItem['RYM Album'];
	} else if (sourceItem['RYM Album'] === collectionItem.RYMID) {
		matchingIdentifier = 'rymId';
	} else {
		return null;
	}

	if (sourceItem.Release_Date !== collectionItem.ReleaseDate?.slice(0, 4)) {
		updates.push({
			field: 'ReleaseDate',
			oldValue: collectionItem.ReleaseDate,
			newValue: sourceItem.Release_Date,
		});
	}
	if (sourceItem.Rating !== '0' && sourceItem.Rating !== collectionItem.Rating) {
		updates.push({
			field: 'Rating',
			oldValue: collectionItem.Rating,
			newValue: sourceItem.Rating,
		});
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
		item: collectionItem,
		updates,
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
			console.log('Importing from RateYourMusic file...');
			const readStream = fs.createReadStream(this.rymFilename);
			const parser = csvParse({ columns: true, delimiter: ',', quote: '"', ltrim: true, rtrim: true });

			parser.on('readable', () => {
				let record: RYMItem;

				while ((record = parser.read() as RYMItem)) {
					let singleItemUpdates: SingleItemUpdates | null = null;

					for (const collectionItem of this.collection) {
						singleItemUpdates = getItemUpdates(record, collectionItem);
						if (singleItemUpdates !== null) {
							break;
						}
					}

					if (singleItemUpdates) {
						this.itemUpdates.updatedItems.push(singleItemUpdates);
					} else {
						// this.collection.push(newItem(record));
						this.itemUpdates.newItems.push(newItem(record));
					}
				}
			});

			parser.on('end', async () => {
				console.log(
					`RateYourMusic: Found ${this.itemUpdates.newItems.length} new albums, ${this.itemUpdates.updatedItems.length} updates.`
				);
				const promptResponses = await inquirer.prompt([
					{
						type: 'checkbox',
						name: 'import-albums-select',
						message: `\nSelect new albums to import:`,
						choices: this.itemUpdates.newItems.map((item) => ({
							name: `${item.Artist} - ${item.Title}`,
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

				resolve({ itemUpdates: this.itemUpdates });
			});

			parser.on('error', (err) => {
				reject(err);
			});
			readStream.pipe(parser);
		});
	}
}
