import { LastFmUpdater } from './updaters/lastfm';
import { RYMUpdater } from './updaters/rym';

export const updaters = {
	rym: RYMUpdater,
	lastfm: LastFmUpdater,
};

export type UpdaterString = keyof typeof updaters;

export interface Item {
	Artist: string;
	Title: string;
	RYMID?: string;
	ReleaseDate: string;
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

export interface ItemUpdates {
	newItems: Array<Item>;
	updatedItems: Array<ItemDiff>;
}

export interface CliConfig {
	collectionFile: string;
	enabledUpdaters: Array<UpdaterString>;
	sources: {
		lastfm: {
			username: string;
		};
		rym: {
			filename: string;
		};
	};
}
