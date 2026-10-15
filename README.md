# Open Food Facts contents

A repository for contents for open food facts websites.

## How it works

Content is managed thanks to [SveltiaCMS](https://sveltiacms.app/),
[installed as a Svelte application](./docs/explain-sveltia.md).

It uses extended markdown syntax.

It offers non technical user a direct preview of the content.

Those content will then be interpreted by open food facts explorer
to render static contents.

## Translating

Translations happens [on crowdin](https://crowdin.com/project/openfoodfacts)
where we have an important community of translators.

## Road map

* replace sveltiacms preview by a live call to explorer to render the page as it would be rendered on the website (maybe sending content in the request)
* add justfile and just commands
* add an enforcement as github actions that files in static are in a year/month subfolder
* add crowdin configuration
