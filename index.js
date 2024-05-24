const chromium = require('playwright-chromium').chromium;
const EventEmitter = require('node:events');
const v8toIstanbul = require('@anthony-redfox/v8-to-istanbul');
const mm = require('micromatch');
const libReport = require('istanbul-lib-report');
const libCoverage = require('istanbul-lib-coverage');
const reports = require('istanbul-reports');
const fs = require('node:fs/promises');
const path = require('node:path');

class ChromePlaywright extends EventEmitter {
	id = Math.random();
	name = chromium.name();
	blackListPaths = ['**/node_modules/**'];
	whiteListPaths = null;
	bundlePaths = [];
	coverageDir = 'coverage';
	reporters = [];

	constructor(config = {}) {
		super();
		const report = config.coverageReporter || {};
		this.coverageDir = report.dir || this.coverageDir;
		this.blackListPaths = report.blackListPaths || this.blackListPaths;
		this.reporters = report.reporters || this.reporters;
		this.whiteListPaths = report.whiteListPaths || this.whiteListPaths;
		this.bundlePaths = report.bundlePaths || this.bundlePaths;
		this.basePath = path.normalize(config.basePath);
	}

	async start(url) {
		this._browser = await chromium.launch({ headless: true });
		this._browser.on('close', () => this.emit('done'));
		this._page = await this._browser.newPage();
		await this._page.coverage.startJSCoverage();
		await this._page.goto(`${url}?id=${this.id}`);
	}

	isCaptured() {
		return true;
	}

	async getMapObject(url, source) {
		const mapFileCommentRegex =
			/(?:\/\/[@#][ \t]+?sourceMappingURL=([^\s'"`]+?)[ \t]*?$)|(?:\/\*[@#][ \t]+sourceMappingURL=([^*]+?)[ \t]*?(?:\*\/){1}[ \t]*?$)/gm;
		const mapUrl = mapFileCommentRegex.exec(source)?.[1];
		if (!mapUrl || mapUrl.startsWith('data:')) {
			return;
		}
		const urlMap = new URL(mapUrl, url);
		if (urlMap.hostname === 'localhost') {
			urlMap.hostname = '127.0.0.1';
		}

		const response = await fetch(urlMap);
		const sourcemap = await response.json();
		return { sourcemap };
	}

	getInnovatorPath(url) {
		const path = new URL(url).pathname;
		const isBundle = this.bundlePaths.includes(path);
		const isBlackList = mm.isMatch(path, this.blackListPaths) && !isBundle;
		const isWhiteList =
			!this.whiteListPaths || mm.isMatch(path, this.whiteListPaths) || isBundle;
		if (!path.startsWith('/base/') || isBlackList || !isWhiteList) {
			return '';
		}
		return path.replace('/base', '');
	}

	convertPath(path) {
		return path.replace(this.basePath, '').replaceAll('\\', '/');
	}

	pathFilter(path = '') {
		if (!path) {
			return false;
		} else if (path.endsWith('.less')) {
			return true;
		}

		const isBlackList = mm.isMatch(
			'/base' + this.convertPath(path),
			this.blackListPaths
		);
		const isWhiteList =
			!this.whiteListPaths ||
			mm.isMatch('/base' + this.convertPath(path), this.whiteListPaths);

		return isBlackList || !isWhiteList;
	}

	async writeCoverage(coverage) {
		const coverageMap = libCoverage.createCoverageMap({});
		const sources = {};
		for (const entry of coverage) {
			const path = this.getInnovatorPath(entry.url);
			if (!path) {
				continue;
			}

			const converter = v8toIstanbul(
				'',
				0,
				{
					source: entry.source,
					sourceMap: await this.getMapObject(entry.url, entry.source)
				},
				(path) => this.pathFilter(path)
			);
			await converter.load();
			converter.applyCoverage(entry.functions);
			const cover = converter.toIstanbul();

			for (const cov of Object.values(cover)) {
				if (!cov.path) {
					cov.path = path;
					sources[path] = entry.source;
				} else if (this.convertPath(cov.path) === path) {
					sources[path] = entry.source;
				} else {
					const path = cov.path;
					cov.path = this.convertPath(cov.path);
					sources[cov.path] = await fs.readFile(path, { encoding: 'utf8' });
				}

				coverageMap.addFileCoverage(cov);
			}
		}

		reports.create('html', { skipEmpty: false }).execute(
			libReport.createContext({
				coverageMap,
				dir: `${this.coverageDir}/lcov-report`,
				sourceFinder: (pathFile) => sources[pathFile]
			})
		);

		for (const reporter of this.reporters) {
			reports.create(reporter.type, { skipEmpty: false }).execute(
				libReport.createContext({
					coverageMap,
					dir: this.coverageDir,
					sourceFinder: (pathFile) => sources[pathFile]
				})
			);
		}
	}

	async forceKill() {
		try {
			const coverage = await this._page.coverage.stopJSCoverage();
			await this.writeCoverage(coverage);
		} catch (e) {
			console.error(e);
		}
		await this._page.close();
		await this._browser.close();
	}
}

module.exports = {
	'launcher:PlaywrightCoverage': [
		'type',
		function (config) {
			return new ChromePlaywright(config);
		}
	]
};
