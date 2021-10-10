import { Collection, Item } from '../types';
import fs from 'fs';
import csvParse from 'csv-parse';
import csvStringify from 'csv-stringify';

export async function readCollectionFile(collectionFile: string): Promise<Collection> {
	return new Promise((resolve, reject) => {
		const collection: Collection = [];
		const readStream = fs.createReadStream(collectionFile);
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

export async function writeCollectionFile(collectionFile: string, collection: Collection): Promise<void> {
	return new Promise((resolve, reject) => {
		const csvRows: Array<string> = [];
		const stringifier = csvStringify({
			delimiter: ',',
			header: true,
			quoted_string: true,
		});

		stringifier.on('readable', () => {
			let row: string;
			while ((row = stringifier.read())) {
				csvRows.push(row.toString());
			}
		});

		stringifier.on('error', (err) => {
			reject(err);
		});

		stringifier.on('finish', () => {
			const csvString = csvRows.join('');
			fs.writeFileSync(collectionFile, csvString);
			resolve();
		});

		collection.sort((a, b) => {
			if (a.Artist.toLowerCase() < b.Artist.toLowerCase()) {
				return -1;
			} else if (a.Artist.toLowerCase() > b.Artist.toLowerCase()) {
				return 1;
			} else return a.Title.toLowerCase() < b.Title.toLowerCase() ? -1 : 1;
		});
		for (const item of collection) {
			// Convert all values to strings
			for (const field of ['RYMID', 'MBID', 'ReleaseDate', 'Rating', 'Plays']) {
				item[field as keyof Item] = `${item[field as keyof Item] ?? ''}`;
			}
			stringifier.write(item);
		}
		stringifier.end();
	});
}
