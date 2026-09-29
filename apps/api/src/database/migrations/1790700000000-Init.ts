import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1790700000000 implements MigrationInterface {
  name = 'Init1790700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "slug" character varying NOT NULL, "names" jsonb NOT NULL, "sortOrder" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_420d9f679d41281f282f5bc7d09" UNIQUE ("slug"), CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "feeds" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "url" character varying NOT NULL, "language" character varying NOT NULL DEFAULT 'auto', "active" boolean NOT NULL DEFAULT true, "fetchIntervalMinutes" integer NOT NULL DEFAULT '30', "etag" character varying, "lastModified" character varying, "lastFetchedAt" TIMESTAMP WITH TIME ZONE, "lastError" character varying, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "defaultCategoryId" uuid, CONSTRAINT "UQ_337f5c8ae0b5ff374c97513ca03" UNIQUE ("url"), CONSTRAINT "PK_3dafbf766ecbb1eb2017732153f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."feed_items_status_enum" AS ENUM('pending', 'done', 'duplicate', 'failed', 'skipped')`,
    );
    await queryRunner.query(
      `CREATE TABLE "feed_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "url" character varying NOT NULL, "guid" character varying, "title" character varying NOT NULL, "titleKey" character varying NOT NULL, "content" text NOT NULL DEFAULT '', "author" character varying, "imageUrl" character varying, "tags" jsonb NOT NULL DEFAULT '[]', "language" character varying NOT NULL, "publishedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "status" "public"."feed_items_status_enum" NOT NULL DEFAULT 'pending', "attempts" integer NOT NULL DEFAULT '0', "error" character varying, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "feedId" uuid, CONSTRAINT "UQ_d85cdfb3ecc910d86e458875324" UNIQUE ("url"), CONSTRAINT "PK_9a33f003d604fbe4060d75c7be2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_50e35ce8c04aa43b2620f1fe78" ON "feed_items"  ("titleKey") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_aea34477fb15c2a985de556506" ON "feed_items"  ("status") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."articles_status_enum" AS ENUM('draft', 'published', 'rejected')`,
    );
    await queryRunner.query(
      `CREATE TABLE "articles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "slug" character varying NOT NULL, "sourceLanguage" character varying NOT NULL, "tags" jsonb NOT NULL DEFAULT '[]', "imageUrl" character varying, "sourceName" character varying NOT NULL, "sourceUrl" character varying, "status" "public"."articles_status_enum" NOT NULL DEFAULT 'draft', "engine" character varying NOT NULL, "publishedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "itemId" uuid, "categoryId" uuid, CONSTRAINT "UQ_1123ff6815c5b8fec0ba9fec370" UNIQUE ("slug"), CONSTRAINT "REL_f5eb9380dfbfe14a3b7eb10e43" UNIQUE ("itemId"), CONSTRAINT "PK_0a6e2c450d83e0b6052c2793334" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5f0a73d2e1cc0db5557ae257d1" ON "articles"  ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3ea038c4c5fe92c259f97356f7" ON "articles"  ("publishedAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "article_translations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "language" character varying NOT NULL, "headline" character varying NOT NULL, "summary" text NOT NULL, "keyPoints" jsonb NOT NULL DEFAULT '[]', "articleId" uuid, CONSTRAINT "UQ_26d5473aef1be3f6b08daaeb223" UNIQUE ("articleId", "language"), CONSTRAINT "PK_8b72b41dad0af13787600c28f2c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."settings_engine_enum" AS ENUM('auto', 'sarvam', 'extractive')`,
    );
    await queryRunner.query(
      `CREATE TABLE "settings" ("id" integer NOT NULL DEFAULT '1', "autoPublish" boolean NOT NULL DEFAULT false, "engine" "public"."settings_engine_enum" NOT NULL DEFAULT 'auto', "targetLanguages" jsonb NOT NULL DEFAULT '["en","hi"]', "batchSize" integer NOT NULL DEFAULT '25', "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_0669fe20e252eb692bf4d344975" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "sites" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "slug" character varying NOT NULL, "domain" character varying, "description" text NOT NULL DEFAULT '', "defaultLanguage" character varying NOT NULL DEFAULT 'en', "languages" jsonb NOT NULL DEFAULT '["en"]', "apiKeyHash" character varying NOT NULL, "apiKeyPrefix" character varying NOT NULL, "active" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_26503a75e987672fb5af9258cc2" UNIQUE ("slug"), CONSTRAINT "PK_4f5eccb1dfde10c9170502595a7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_fb741868a36c9bbd3000d65d75" ON "sites"  ("apiKeyHash") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('admin', 'editor')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "name" character varying NOT NULL, "passwordHash" character varying NOT NULL, "role" "public"."users_role_enum" NOT NULL DEFAULT 'editor', "active" boolean NOT NULL DEFAULT true, "lastLoginAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "site_categories" ("sitesId" uuid NOT NULL, "categoriesId" uuid NOT NULL, CONSTRAINT "PK_faa63ce472f1b2e6177eba00d61" PRIMARY KEY ("sitesId", "categoriesId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_498e4075a255c0c1079b1d1b46" ON "site_categories"  ("sitesId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_07df53ce07a239ab458403e887" ON "site_categories"  ("categoriesId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "feeds" ADD CONSTRAINT "FK_80d1b254a336a9ea5d9648293f4" FOREIGN KEY ("defaultCategoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "feed_items" ADD CONSTRAINT "FK_b32b47b9f9770cf96a5f66424da" FOREIGN KEY ("feedId") REFERENCES "feeds"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "articles" ADD CONSTRAINT "FK_f5eb9380dfbfe14a3b7eb10e431" FOREIGN KEY ("itemId") REFERENCES "feed_items"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "articles" ADD CONSTRAINT "FK_9cf383b5c60045a773ddced7f23" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "article_translations" ADD CONSTRAINT "FK_1866fd118ad8af4e59ec97d5dcb" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "site_categories" ADD CONSTRAINT "FK_498e4075a255c0c1079b1d1b462" FOREIGN KEY ("sitesId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "site_categories" ADD CONSTRAINT "FK_07df53ce07a239ab458403e8871" FOREIGN KEY ("categoriesId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "site_categories" DROP CONSTRAINT "FK_07df53ce07a239ab458403e8871"`,
    );
    await queryRunner.query(
      `ALTER TABLE "site_categories" DROP CONSTRAINT "FK_498e4075a255c0c1079b1d1b462"`,
    );
    await queryRunner.query(
      `ALTER TABLE "article_translations" DROP CONSTRAINT "FK_1866fd118ad8af4e59ec97d5dcb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "articles" DROP CONSTRAINT "FK_9cf383b5c60045a773ddced7f23"`,
    );
    await queryRunner.query(
      `ALTER TABLE "articles" DROP CONSTRAINT "FK_f5eb9380dfbfe14a3b7eb10e431"`,
    );
    await queryRunner.query(
      `ALTER TABLE "feed_items" DROP CONSTRAINT "FK_b32b47b9f9770cf96a5f66424da"`,
    );
    await queryRunner.query(
      `ALTER TABLE "feeds" DROP CONSTRAINT "FK_80d1b254a336a9ea5d9648293f4"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_07df53ce07a239ab458403e887"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_498e4075a255c0c1079b1d1b46"`,
    );
    await queryRunner.query(`DROP TABLE "site_categories"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fb741868a36c9bbd3000d65d75"`,
    );
    await queryRunner.query(`DROP TABLE "sites"`);
    await queryRunner.query(`DROP TABLE "settings"`);
    await queryRunner.query(`DROP TYPE "public"."settings_engine_enum"`);
    await queryRunner.query(`DROP TABLE "article_translations"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3ea038c4c5fe92c259f97356f7"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5f0a73d2e1cc0db5557ae257d1"`,
    );
    await queryRunner.query(`DROP TABLE "articles"`);
    await queryRunner.query(`DROP TYPE "public"."articles_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_aea34477fb15c2a985de556506"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_50e35ce8c04aa43b2620f1fe78"`,
    );
    await queryRunner.query(`DROP TABLE "feed_items"`);
    await queryRunner.query(`DROP TYPE "public"."feed_items_status_enum"`);
    await queryRunner.query(`DROP TABLE "feeds"`);
    await queryRunner.query(`DROP TABLE "categories"`);
  }
}
