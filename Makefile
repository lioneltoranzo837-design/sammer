.PHONY: deploy build run serve

VERCEL_CLI_VERSION := 54.14.5
PORT ?= 3000

build:
	npm run build:ts

deploy: build
	npm exec --yes --package vercel@$(VERCEL_CLI_VERSION) -- vercel deploy --prod --yes

run serve: build
	npm exec --yes --package vercel@$(VERCEL_CLI_VERSION) -- vercel dev --port $(PORT)

