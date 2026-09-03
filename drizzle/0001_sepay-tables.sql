CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"provider" text DEFAULT 'sepay' NOT NULL,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'VND' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"sepay_transaction_id" bigint,
	"sepay_gateway" text,
	"sepay_account_number" text,
	"sepay_content" text,
	"sepay_reference_code" text,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sepay_webhook_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"transaction_id" bigint NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"action" text NOT NULL,
	"order_id" uuid,
	"order_code" text,
	"error_message" text,
	"success" text DEFAULT 'false' NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sepay_webhook_logs" ADD CONSTRAINT "sepay_webhook_logs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payments_sepay_transaction_id_unique" ON "payments" USING btree ("sepay_transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_order_id_active_unique" ON "payments" USING btree ("order_id") WHERE status <> 'failed';--> statement-breakpoint
CREATE INDEX "payments_order_id_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sepay_webhook_logs_transaction_id_unique" ON "sepay_webhook_logs" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "sepay_webhook_logs_order_id_idx" ON "sepay_webhook_logs" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "sepay_webhook_logs_processed_at_idx" ON "sepay_webhook_logs" USING btree ("processed_at");