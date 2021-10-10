#!/usr/bin/env node

import { CliConfig, Collection, Identifier, Item, ItemUpdates, updaters, Source } from './types';
import fs from 'fs';
import { readCollectionFile, writeCollectionFile } from './util/csv';
import dotenv from 'dotenv';
dotenv.config();

// TODO: Store in global config file
const config: CliConfig = {
	collectionFile: './albums.csv',
	enabledUpdaters: ['rym', 'lastfm'],
	sources: {
		lastfm: {
			username: 'elias-jackson2',
			apiKey: process.env.LASTFM_API_KEY ?? '',
			playsThreshold: 100,
		},
		rym: {
			filename: './user_albums_export.txt',
		},
	},
};

const command = process.argv[2];
const options = process.argv.slice(3);

const isValidUpdater = (cliParam: string): cliParam is Source => {
	return Object.keys(updaters).includes(cliParam);
};

(async () => {
	try {
		switch (command) {
			case 'update':
				const collection = await readCollectionFile(config.collectionFile);
				if (options[0] && !options[0].startsWith('--')) {
					if (isValidUpdater(options[0])) {
						const updaterString = options[0];
						const updaterClass = updaters[updaterString];
						const updaterInstance = new updaterClass(config, collection);
						const itemUpdates = {
							[updaterString]: (await updaterInstance.update()).itemUpdates,
						};
						fs.writeFileSync('item-updates.json', JSON.stringify(itemUpdates, undefined, 2));
						await writeCollectionFile('albums-new.csv', collection);
						break;
					} else {
						throw new Error(
							`${options[0]} is not a valid updater. Try one of [${Object.keys(updaters).join(
								', '
							)}] or type 'patrician update' to update all.`
						);
					}
				}
				const itemUpdates: Record<string, ItemUpdates> = {};
				for (const updaterString of config.enabledUpdaters) {
					const updaterClass = updaters[updaterString];
					const updaterInstance = new updaterClass(config, collection);
					itemUpdates[updaterString] = (await updaterInstance.update()).itemUpdates;
				}
				fs.writeFileSync('item-updates.json', JSON.stringify(itemUpdates, undefined, 2));
				await writeCollectionFile('albums-new.csv', collection);
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
