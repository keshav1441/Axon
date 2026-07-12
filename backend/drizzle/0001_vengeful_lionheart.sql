CREATE TABLE IF NOT EXISTS "category_rules" (
	"user_id" text NOT NULL,
	"keyword" text NOT NULL,
	"category" text NOT NULL,
	CONSTRAINT "category_rules_user_id_keyword_pk" PRIMARY KEY("user_id","keyword")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "focus_apps" (
	"user_id" text NOT NULL,
	"package_name" text NOT NULL,
	"label" text NOT NULL,
	"budget_minutes" integer,
	CONSTRAINT "focus_apps_user_id_package_name_pk" PRIMARY KEY("user_id","package_name")
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "account_tail" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "category_rules" ADD CONSTRAINT "category_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "focus_apps" ADD CONSTRAINT "focus_apps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
