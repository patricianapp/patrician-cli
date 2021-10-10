#!/usr/bin/env node

import { CliConfig, Collection, Identifier, Item, ItemUpdates, updaters, UpdaterString } from './types';
import fs from 'fs';
import csvParse from 'csv-parse';
import csvStringify from 'csv-stringify';
import { readCollectionFile, writeCollectionFile } from './util/csv';

// TODO: Store in global config file
const config: CliConfig = {
	collectionFile: './albums.csv',
	enabledUpdaters: ['rym'],
	sources: {
		lastfm: {
			username: 'elias-jackson2',
		},
		rym: {
			filename: './user_albums_export.txt',
		},
	},
};

const command = process.argv[2];
const options = process.argv.slice(3);

const isValidUpdater = (cliParam: string): cliParam is UpdaterString => {
	return Object.keys(updaters).includes(cliParam);
};

function itemMatchesIdentifier(item: Item, identifier: Identifier) {
	return identifier.idType === 'rymId' && item.RYMID === identifier.value;
}

function applyItemUpdates(collection: Collection, itemUpdates: ItemUpdates): Collection {
	const newCollection: Collection = itemUpdates.newItems;
	const oldItemsUpdated = collection.map((item) => {
		const singleItemUpdate = itemUpdates.updatedItems.find((itemDiff) =>
			itemMatchesIdentifier(item, itemDiff.identifier)
		);
		if (!singleItemUpdate) {
			return item;
		}
		// for now, just replace old data
		return {
			Artist: singleItemUpdate.newData.Artist ?? item.Artist,
			Title: singleItemUpdate.newData.Title ?? item.Title,
			ReleaseDate: singleItemUpdate.newData.ReleaseDate ?? item.ReleaseDate,
			RYMID: singleItemUpdate.newData.RYMID ?? item.RYMID,
		};
	});
	newCollection.concat(...oldItemsUpdated);
	return newCollection;
}

(async () => {
	try {
		switch (command) {
			case 'update':
				const collection = await readCollectionFile(config.collectionFile);
				if (options[0] && !options[0].startsWith('--')) {
					if (isValidUpdater(options[0])) {
						const updater = updaters[options[0]];
						// updater.update(options.slice(1));
					} else {
						throw new Error(
							`${options[0]} is not a valid updater. Try one of [${Object.keys(updaters).join(
								', '
							)}] or type 'patrician update' to update all.`
						);
					}
				}
				const itemUpdates: ItemUpdates = {
					newItems: [],
					updatedItems: [],
				};
				for (const updaterString of config.enabledUpdaters) {
					const updaterClass = updaters[updaterString];
					const updaterInstance = new updaterClass(config, collection);
					const { newItems, updatedItems } = await updaterInstance.fetchUpdates();
					itemUpdates.newItems = itemUpdates.newItems.concat(newItems);
					itemUpdates.updatedItems = itemUpdates.updatedItems.concat(updatedItems);
				}
				fs.writeFileSync('item-updates.json', JSON.stringify(itemUpdates, undefined, 2));
				const newCollection = applyItemUpdates(collection, itemUpdates);
				await writeCollectionFile('albums-new.csv', newCollection);

				break;
			default:
				throw new Error('No subcommand given.');
		}
	} catch (err) {
		if (err instanceof Error) {
			console.error(err.message);
		}
		process.exit(1);
	}
})();
// TODO: Extension test thing that Jackson told me about
