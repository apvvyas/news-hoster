import type { MigrationInterface, QueryRunner } from 'typeorm';

const CATEGORIES: [slug: string, en: string, hi: string][] = [
  ['india', 'India', 'भारत'],
  ['world', 'World', 'विश्व'],
  ['politics', 'Politics', 'राजनीति'],
  ['business', 'Business', 'व्यापार'],
  ['technology', 'Technology', 'तकनीक'],
  ['science', 'Science', 'विज्ञान'],
  ['health', 'Health', 'स्वास्थ्य'],
  ['sports', 'Sports', 'खेल'],
  ['entertainment', 'Entertainment', 'मनोरंजन'],
  ['other', 'Other', 'अन्य'],
];

/** Starter categories (English + Hindi names). Edit freely in the admin. */
export class SeedCategories1790700000001 implements MigrationInterface {
  name = 'SeedCategories1790700000001';

  public async up(q: QueryRunner): Promise<void> {
    for (const [i, [slug, en, hi]] of CATEGORIES.entries()) {
      await q.query(
        `INSERT INTO "categories" ("slug", "names", "sortOrder") VALUES ($1, $2, $3) ON CONFLICT ("slug") DO NOTHING`,
        [slug, JSON.stringify({ en, hi }), i * 10],
      );
    }
    await q.query(
      `INSERT INTO "settings" ("id") VALUES (1) ON CONFLICT DO NOTHING`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DELETE FROM "categories" WHERE "slug" = ANY($1)`, [
      CATEGORIES.map(([slug]) => slug),
    ]);
  }
}
