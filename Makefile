.PHONY: deploy build

VERCEL_CLI_VERSION := 54.14.5

build:
	npm run build:ts

deploy: build
	npm exec --yes --package vercel@$(VERCEL_CLI_VERSION) -- vercel deploy --prod --yes
