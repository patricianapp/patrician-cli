import { CliConfig, Collection, ItemUpdates } from '../types';

export class LastFmUpdater {
	private filename: string;

	constructor(config: CliConfig) {
		this.filename = config.sources.rym.filename;
	}

	// Diffs source and collection file
	async update(): Promise<{ newCollection: Collection; itemUpdates: ItemUpdates }> {
		return new Promise((resolve, reject) => {
			resolve({
				newCollection: [],
				itemUpdates: {
					newItems: [],
					updatedItems: [],
				},
			});
		});
	}
}
