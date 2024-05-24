# karma-coverage-up

Karma coverage which base on Playwright

## Examples

### Basic

```javascript
// karma.conf.js
module.exports = function(config) {
  config.set({
    files: [
      'src/**/*.js',
      'test/**/*.js'
    ],

    browsers: ['PlaywrightCoverage']

    // configure the reporter
    coverageReporter: {
      reporters : [{ type: 'html' }],
      whiteListPaths: ['src/**/*.js']
    }
  });
};


# Configuration

### `dir`

**Type:** String
**Default** `coverage`

**Description:** This will be used to output coverage reports. When
you set a relative path, the directory is resolved against the `basePath`.

### `reporters`

**Type:** Array of Object [{ type: String }]
**Possible Types:**

- `html` (default)
- `lcov` (lcov and html)
- `lcovonly`
- `text`
- `text-summary`
- `cobertura` (xml format supported by Jenkins)
- `teamcity` (code coverage System Messages for TeamCity)
- `json` (json format supported by [`grunt-istanbul-coverage`](https://github.com/daniellmb/grunt-istanbul-coverage))
- `json-summary`
- `in-memory` (supported since v0.5.4)
- `none` (Does nothing. Use to specify that no reporting is needed)

**Description:** This is list of reporters which will be generated

### `blackListPaths`

**Type:** Array of String
**Default**: ['\*\*/node_modules/\*\*']

**Description:** List of Paths which will be coverage ignore

### `whiteListPaths`

**Type:** Array of String

**Description:** List of Paths which will be included to coverage report

### `bundlePaths`

**Type:** Array of String

**Description:** List of Paths which need to analyze
```
