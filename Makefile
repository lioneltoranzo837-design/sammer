.PHONY: deploy

VERCEL_CLI_VERSION := 54.14.5

deploy:
	npm exec --yes --package vercel@$(VERCEL_CLI_VERSION) -- vercel deploy --prod --yes
