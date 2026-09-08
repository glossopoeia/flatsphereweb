# Build-time wiring between the projection catalog and the gallery detail pages.
#
# The `_projections/<slug>.md` stubs carry only `slug` + `description`; a projection's real
# name lives in data/projections.json (staged to _data/ by `make serve` and by the deploy
# workflow). Jekyll gives every collection document a fallback `title` by title-casing its
# filename ("wagner-ix" → "Wagner Ix"), and jekyll-seo-tag builds <title> and the Open Graph
# title from page.title, so without this hook the detail pages ship those mangled names.
# A layout can't fix it: the fallback is assigned when the document is read, before any
# Liquid runs, and Liquid cannot reassign page.title.
#
# So, once the site is read (data and collections both loaded), set each stub's `title`
# from its catalog record. The catalog name is the single source of truth — a `title:` in a
# stub's front matter is overwritten rather than honoured.
#
# Consistency policy, and how it degrades:
#   * A stub whose slug has no catalog record, or a catalog record with no stub (the app's
#     dropdown offers every catalog entry, so an entry without a detail page is a broken site),
#     fails `jekyll build` — the same FatalException treatment as require_post_excerpt.rb, so a
#     deploy stops with the clean "could not be built" banner and a non-zero exit.
#     Under `jekyll serve` / `--watch` the same problems are only warned about. jekyll-watch
#     rescues anything raised during a regeneration and keeps serving the previous _site, so a
#     raise there would freeze the dev loop on a stale build with only two warning lines as a
#     clue. Warning lets the regeneration finish: an orphan stub then renders the layout's visible
#     "Unknown projection" page and an entry without a stub is simply absent from the gallery
#     grid until fixed.
#   * No catalog data at all (almost always `_data/` not staged: `make serve` and the deploy
#     workflow do it, a bare `bundle exec jekyll build` does not) is warned about in both modes
#     rather than failing the blog, app index and everything else with it. The site builds with
#     an empty gallery and fallback titles, and the warning names the staging command.
# Messages are single lines because Jekyll's logger collapses whitespace.

Jekyll::Hooks.register :site, :post_read do |site|
  stubs = site.collections["projections"]&.docs || []
  next if stubs.empty?

  records = site.data["projections"]
  unless records.is_a?(Array) && !records.empty?
    Jekyll.logger.warn "Projections:",
                       "no catalog found in site.data (expected _data/projections.json), so gallery " \
                       "pages get fallback titles. Stage it with `cp data/projections.json " \
                       "_data/projections.json` — `make serve` and the deploy workflow do this automatically."
    next
  end

  names_by_shader = records.each_with_object({}) do |record, index|
    index[record["shader"]] = record["name"] if record["shader"] && record["name"]
  end

  orphans = []
  stub_slugs = []
  stubs.each do |doc|
    slug = doc.data["slug"] || doc.basename_without_ext
    stub_slugs << slug
    name = names_by_shader[slug]
    if name
      doc.data["title"] = name
    else
      orphans << doc.relative_path
    end
  end
  missing_stubs = names_by_shader.keys - stub_slugs

  problems = []
  unless orphans.empty?
    problems << "#{orphans.size} projection stub(s) have no matching `shader` entry in " \
                "data/projections.json: #{orphans.join(", ")}."
  end
  unless missing_stubs.empty?
    problems << "#{missing_stubs.size} catalog entry(ies) have no _projections/<shader>.md stub: " \
                "#{missing_stubs.join(", ")}."
  end
  next if problems.empty?

  message = problems.join(" ") +
            " Each stub's `slug` must equal a catalog entry's `shader`, and every entry needs a stub."

  if site.config["serving"] || site.config["watch"]
    Jekyll.logger.warn "Projections:", message
  else
    raise Jekyll::Errors::FatalException, message
  end
end
