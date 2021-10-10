import { CliConfig, ItemUpdates } from '../types';

export class LastFmUpdater {
	private filename: string;

	constructor(config: CliConfig) {
		this.filename = config.sources.rym.filename;
	}

	// Diffs source and collection file
	async fetchUpdates(): Promise<ItemUpdates> {
		return new Promise((resolve, reject) => {
			resolve({
				newItems: [],
				updatedItems: [],
			});
		});
	}
}
