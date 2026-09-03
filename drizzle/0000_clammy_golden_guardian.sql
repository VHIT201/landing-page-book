CREATE TABLE "order_status_history" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"actor" text NOT NULL,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"address_line" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" integer NOT NULL,
	"shipping_fee" integer DEFAULT 0 NOT NULL,
	"total_amount" integer NOT NULL,
	"status" text DEFAULT 'pending_payment' NOT NULL,
	"paid_at" timestamp with time zone,
	"carrier" text,
	"tracking_no" text,
	"admin_note" text,
	"source" text,
	CONSTRAINT "orders_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;