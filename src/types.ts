import { LastFmUpdater } from './updaters/lastfm';
import { RYMUpdater } from './updaters/rym';

export const updaters = {
	rym: RYMUpdater,
	lastfm: LastFmUpdater,
};

export type Source = keyof typeof updaters;

export interface Item {
	Artist: string;
	Title: string;
	RYMID?: string;
	MBID?: string;
	ReleaseDate?: string;
	Rating?: string;
	Plays?: string;
}

export type Collection = Array<Item>;

export interface Identifier {
	idType: 'mbid' | 'rymId' | 'artist-title';
	value: string;
}

export interface ItemDiff {
	identifier: Identifier;
	oldData: Partial<Item>;
	newData: Partial<Item>;
}

export interface SingleItemUpdates {
	matchingIdentifier: Identifier['idType'];
	identifiers: Array<Identifier>;
	source: Source;
	oldData: Partial<Item>;
	newData: Partial<Item>;
}

export interface ItemUpdates {
	newItems: Array<Item>;
	updatedItems: Array<SingleItemUpdates>;
}

export interface CliConfig {
	collectionFile: string;
	enabledUpdaters: Array<Source>;
	sources: {
		lastfm: {
			username: string;
			apiKey: string;
			playsThreshold: number;
		};
		rym: {
			filename: string;
		};
	};
}
