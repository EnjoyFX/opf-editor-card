# Jira CSV → feature table slide

`npm run jira-csv` turns a CSV exported from Jira into a deck with one table slide:

| Feature | BV | Ticket | Status |
| --- | --- | --- | --- |
| feature name (the issue's Summary) | business value, the cell shaded darker blue for a higher value | issue key, linked to Jira | `Done`, or the issue's own status in bold blue |

- **Row order** follows the CSV. Features that are not done move to the end, in CSV order.
- **Title** comes from the data: "X is the last feature left", "N of M features are done", or "All N features are done".
- **Caption** under the table: "Darker blue means higher business value (BV). Source: Jira export, <date>."
- **Deck language** is `en-US`.

## The CSV

One row per feature, with a header row:

```csv
Summary,Issue key,Status,Business Value
Single sign-on,ABC-101,Done,8
User profile,ABC-102,Done,7
Product catalog,ABC-103,Done,9
Release Readiness,ABC-110,In Progress,8
```

Columns:
- **Summary** is the feature name.
- **Issue key** is the ticket key.
- **Status**: `Done`, `Closed`, `Resolved` and `Released` (any case) all show as `Done`. Any other value is shown as written, in bold blue.
- **BV** is the first column whose header contains `Business Value`, such as `Custom field (Business Value)`, or is exactly `BV`. For another name, pass `--bv-column "<name>"`. Values are numbers; `8` and `8.0` both show as `8`.

Format:
- The column order does not matter, and other columns are ignored. Exception: when an `Issue Type` column is present, only `Epic` rows become features.
- Text is UTF-8, as Jira exports it (a BOM is fine). The separator is a comma or a semicolon.
- Values that contain the separator, quotes or line breaks are quoted the CSV way.
- Jira's own **Export → CSV** has these headers already.

**BV on a parent issue.** If the BV is kept on a parent issue (for example an Objective above each epic), give both CSVs:

```sh
npm run jira-csv -- epics.csv parents.csv
```

The epics' CSV needs a `Parent` (or `Parent id`, `Parent key`, `Parent Link`) column holding the parent's key or numeric id. The parents' CSV needs `Issue key` (and `Issue id` when `Parent` holds ids) and the BV column. An epic's own BV, when it has one, wins.

If an epic gets no BV, the script names it and prints `issue in (…)` with the missing parents, ready to paste into a Jira search.

## Run it

```sh
npm run jira-csv -- ~/Downloads/features.csv --base https://<site>.atlassian.net
```

The script writes `decks/release-bv.opf.md` and validates it, as `npm run check` does. A running server shows the new deck at `?deck=release-bv.opf.md` after a page reload.

| Option | Effect |
| --- | --- |
| `--base <url>` or env `JIRA_BASE_URL` | Links each key to `<url>/browse/<key>`. Without it the keys are plain text. |
| `--out decks/<name>.opf.md` | Writes another file. The default overwrites `decks/release-bv.opf.md`. |
| `--title "…"` | Replaces the generated title. |
| `--bv-column "<name>"` | Names the BV column. |

With more than 12 rows the script warns: the table text shrinks to fit, so consider splitting the slide.

PowerPoint: `npm run export -- decks/release-bv.opf.md out/release.pptx`. The table stays editable, and the links work.
