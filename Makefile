# Convenience targets (canonical deploy uses both compose files + NPM networks).
.PHONY: deploy
deploy:
	@./deploy.sh
