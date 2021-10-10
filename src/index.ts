#!/usr/bin/env node

import { CliConfig, Collection, Item, ItemUpdates, updaters, UpdaterString } from './types';
import fs from 'fs';
import csvParse from 'csv-parse';

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

async function getCollection(): Promise<Collection> {
	return new Promise((resolve, reject) => {
		const collection: Collection = [];
		const readStream = fs.createReadStream(config.collectionFile);
		const parser = csvParse({ delimiter: ',', columns: true });

		parser.on('readable', () => {
			let record;
			while ((record = parser.read())) {
				collection.push(record as Item);
			}
		});

		parser.on('end', () => {
			resolve(collection);
		});

		parser.on('error', (err) => {
			reject(err);
		});
		readStream.pipe(parser);
	});
}

(async () => {
	try {
		switch (command) {
			case 'update':
				const collection = await getCollection();
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
