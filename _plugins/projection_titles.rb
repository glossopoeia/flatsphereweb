# Build-time wiring between the projection catalog and the gallery detail pages.
#
# The `_projections/<slug>.md` stubs carry only `slug` + `description`; a projection's real
# name lives in data/projections.json, which Jekyll reads in place (`data_dir: data` in
# _config.yml). Jekyll gives every collection document a fallback `title` by title-casing its
# filename ("wagner-ix" → "Wagner Ix"), and jekyll-seo-tag builds <title> and the Open Graph
# title from page.title, so without this hook the detail pages ship those mangled names.
# A layout can't fix it: the fallback is assigned when the document is read, before any
# Liquid runs, and Liquid cannot reassign page.title.
#
# So, once the site is read (data and collections both loaded), set each stub's `title`
# from its catalog record. The catalog name is the single source of truth — a `title:` in a
# stub's front matter is overwritten rather than honoured.
#
# Three states are problems, reported through BuildGuard (_plugins/build_guard.rb: fatal under
# `jekyll build`, a warning under serve/watch):
#   * no usable catalog (data/projections.json missing, empty, or not a top-level array);
#   * a stub whose slug has no catalog record (under serve it renders the layout's visible
#     "Unknown projection" page);
#   * a catalog record with no stub (the app's dropdown offers every catalog entry, so an
#     entry without a detail page is a broken site). That includes the whole collection being
#     empty or unconfigured, which is why there is no early exit when there are no stubs.

Jekyll::Hooks.register :site, :post_read do |site|
  stubs = site.collections["projections"]&.docs || []
  records = site.data["projections"]
  problems = []

  if records.nil?
    problems << "no projection catalog: data/projections.json was not found " \
                "(Jekyll reads it in place via `data_dir: data` in _config.yml)."
  elsif !records.is_a?(Array) || records.empty?
    problems << "data/projections.json is empty or not a top-level JSON array of projection records."
  else
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

    unless orphans.empty?
      problems << "#{orphans.size} projection stub(s) have no matching `shader` entry in " \
                  "data/projections.json: #{orphans.join(", ")}. A stub's `slug` must equal " \
                  "a catalog entry's `shader`."
    end
    unless missing_stubs.empty?
      problems << "#{missing_stubs.size} catalog entry(ies) have no _projections/<shader>.md " \
                  "stub: #{missing_stubs.join(", ")}. Every catalog entry needs a stub."
    end
  end

  BuildGuard.fail_or_warn(site, "Projections", problems.join(" ")) unless problems.empty?
end
