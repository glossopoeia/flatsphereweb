# `make serve` runs the local Jekyll preview. Two responsibilities:
#   1. Stage data/projections.json into gitignored _data/ for Jekyll
#   2. Watch the source data file in the background so edits propagate without a restart
serve:
	@command -v fswatch >/dev/null 2>&1 || { echo "Error: fswatch not installed. macOS: 'brew install fswatch'. Linux: 'apt install fswatch'."; exit 1; }
	mkdir -p _data
	cp data/projections.json _data/projections.json
	@fswatch -o data/projections.json | while read -r _; do cp data/projections.json _data/projections.json; done & \
	  WATCH_PID=$$!; \
	  trap 'kill $$WATCH_PID 2>/dev/null' EXIT INT TERM; \
	  bundle exec jekyll serve --livereload
