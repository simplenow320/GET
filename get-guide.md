# get — User Guide

**get** is a lightweight CMS built for vibe coders. It gives your clients a simple editor to update text, images, and links on their site — without touching your code.

---

## How it works

You define which parts of a page are editable (fields), drop one script tag into your project, and hand your client a login. They edit. It goes live. You never have to touch the project for routine content updates again.

---

## Quick start (for vibe coders)

### 1. Create a project

Log in at [get-builder.replit.app](https://get-builder.replit.app) and click **New project**. Give it a name — one project per site works best.

### 2. Add your content fields

Inside your project, open the **Fields** tab and click **Add field**.

Each field needs:
- A **name** (shown to the client, e.g. "Hero headline")
- A **key** (used in the script, e.g. `hero.headline`)
- A **type** — Text, Long text, Image, Link, or Number

Add as many fields as you want. You can add more later without touching the script.

### 3. Add the script to your Replit project

Open the **Install** tab on your project page. Copy the code snippet and paste it before the closing `</body>` tag in your Replit app's HTML.

The snippet is a one-line `<script>` call that pulls your latest content automatically whenever the page loads. **You only do this once.**

### 4. Bind fields to your HTML

Wherever you want managed content to appear, add a `data-get-key` attribute:

```html
<h1 data-get-key="hero.headline">Default text here</h1>
<img data-get-key="hero.image" src="default.jpg" />
<a data-get-key="cta.link" href="#">Get started</a>
```

The script swaps in the live value automatically. The default text/src shows while loading.

### 5. Invite your client

Open the **Members** tab and invite your client by email. Assign them the **Editor** role — they can edit fields but can't change settings or invite others.

---

## Roles

| Role | Can do |
|---|---|
| **Owner** | Everything — settings, fields, members, delete |
| **Admin** | Everything except delete and ownership transfer |
| **Editor** | Edit content fields only |
| **Viewer** | Read-only access |

---

## Auto-publish (your choice)

By default, client edits go live the moment they hit Save. This is the fastest experience for clients.

If you want to review before anything goes live, go to **Settings → Client publishing** and turn off auto-publish. Client edits will queue as drafts. You review and publish them from the **Drafts** tab.

> This setting is per-project, so you can run some projects hands-off and others with approval.

---

## For your clients: editing content

1. Log in at [get-builder.replit.app](https://get-builder.replit.app)
2. Click your project
3. Click **Editor**
4. Edit any field — text, image, link
5. Hit **Save**

That's it. If auto-publish is on, the live site updates immediately. If the owner has approval turned on, the edit is sent for review.

**Images:** paste a URL or upload a file (JPG, PNG, WebP, GIF, SVG — max 10 MB).

---

## Activity log

The **Activity** tab shows every edit, who made it, and when. Useful for auditing or rolling back a change manually.

---

## Field types

| Type | Best for |
|---|---|
| **Text** | Headlines, labels, short copy |
| **Long text** | Paragraphs, bio sections, descriptions |
| **Image** | Hero images, logos, avatars, thumbnails |
| **Link** | Button URLs, nav links, CTA destinations |
| **Number** | Prices, counts, stats |

---

## Tips

- **Keep field keys short and consistent** — once set, changing a key breaks the binding on your live site until you update the HTML attribute too.
- **Set sensible defaults in your HTML** — they show if the script hasn't loaded yet or on first install before content is entered.
- **Multiple clients, one project** — you can invite a whole team. Everyone edits the same fields; the activity log tracks who changed what.
- **Test installs locally first** — open your Replit dev URL, check the browser console for any `get:` errors before you share the project with a client.

---

## Troubleshooting

**Content isn't showing on the page**
Check that the `data-get-key` value exactly matches the field key in get (case-sensitive). Also confirm the script tag is present and loading without errors in the browser console.

**Client can't log in**
Make sure you invited them via the Members tab and they signed up with the same email address you invited.

**Edit saved but site not updated**
If auto-publish is off, the edit is in the Drafts queue. Log in as owner/admin and publish it from the Drafts tab.

---

*get — built for vibe coders at [get-builder.replit.app](https://get-builder.replit.app)*
