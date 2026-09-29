import { MigrationInterface, QueryRunner } from 'typeorm';

export class EditorialFeatures1790800000000 implements MigrationInterface {
  name = 'EditorialFeatures1790800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."article_chat_messages_role_enum" AS ENUM('user', 'assistant')`,
    );
    await queryRunner.query(
      `CREATE TABLE "article_chat_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "language" character varying NOT NULL, "role" "public"."article_chat_messages_role_enum" NOT NULL, "content" text NOT NULL, "proposal" jsonb, "appliedRevisionId" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "articleId" uuid, "authorId" uuid, CONSTRAINT "PK_64a32560c2f6b87fff76ca8e805" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b0fc46657c2347b9c7fcb9abdd" ON "article_chat_messages"  ("articleId", "language", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "article_revisions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "language" character varying NOT NULL, "content" jsonb NOT NULL, "note" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "articleId" uuid, "authorId" uuid, CONSTRAINT "PK_e5a3375569c46d93baa9fe4bfe4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5beda73f92d38f40718f257a91" ON "article_revisions"  ("articleId", "language", "createdAt") `,
    );
    await queryRunner.query(
      `ALTER TABLE "articles" ADD "canonicalUrl" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "articles" ADD "noindex" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "article_translations" ADD "body" text NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "article_translations" ADD "seoTitle" character varying NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "article_translations" ADD "metaDescription" character varying NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "article_translations" ADD "focusKeyword" character varying NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."articles_status_enum" ADD VALUE 'trash'`,
    );
    await queryRunner.query(
      `ALTER TABLE "article_chat_messages" ADD CONSTRAINT "FK_402373b841cf5e0f3301520be60" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "article_chat_messages" ADD CONSTRAINT "FK_def88c5438c68da4bb45a71687e" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "article_revisions" ADD CONSTRAINT "FK_1bd801757181b575874ccd019ca" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "article_revisions" ADD CONSTRAINT "FK_6b4e3d18f9b38344fd177175445" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "article_revisions" DROP CONSTRAINT "FK_6b4e3d18f9b38344fd177175445"`,
    );
    await queryRunner.query(
      `ALTER TABLE "article_revisions" DROP CONSTRAINT "FK_1bd801757181b575874ccd019ca"`,
    );
    await queryRunner.query(
      `ALTER TABLE "article_chat_messages" DROP CONSTRAINT "FK_def88c5438c68da4bb45a71687e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "article_chat_messages" DROP CONSTRAINT "FK_402373b841cf5e0f3301520be60"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."articles_status_enum_old" AS ENUM('draft', 'published', 'rejected')`,
    );
    await queryRunner.query(
      `ALTER TABLE "articles" ALTER COLUMN "status" TYPE "public"."articles_status_enum_old" USING "status"::"text"::"public"."articles_status_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."articles_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."articles_status_enum_old" RENAME TO "articles_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "article_translations" DROP COLUMN "focusKeyword"`,
    );
    await queryRunner.query(
      `ALTER TABLE "article_translations" DROP COLUMN "metaDescription"`,
    );
    await queryRunner.query(
      `ALTER TABLE "article_translations" DROP COLUMN "seoTitle"`,
    );
    await queryRunner.query(
      `ALTER TABLE "article_translations" DROP COLUMN "body"`,
    );
    await queryRunner.query(`ALTER TABLE "articles" DROP COLUMN "noindex"`);
    await queryRunner.query(
      `ALTER TABLE "articles" DROP COLUMN "canonicalUrl"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5beda73f92d38f40718f257a91"`,
    );
    await queryRunner.query(`DROP TABLE "article_revisions"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b0fc46657c2347b9c7fcb9abdd"`,
    );
    await queryRunner.query(`DROP TABLE "article_chat_messages"`);
    await queryRunner.query(
      `DROP TYPE "public"."article_chat_messages_role_enum"`,
    );
  }
}
