-- CreateTable
CREATE TABLE "admins" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "is_protected" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "houses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'Circle',
    "login_code" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "houses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "house_id" TEXT NOT NULL,
    "student_name" TEXT,
    "last_seen_at" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "clue_letters" TEXT NOT NULL,
    "hero_name" TEXT NOT NULL,
    "heroine_name" TEXT NOT NULL,
    "movie_name" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 1,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rounds" (
    "id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "locked_house_id" TEXT,
    "locked_device_id" TEXT,
    "locked_at" BIGINT,
    "answers" TEXT,
    "result" TEXT,
    "points_awarded" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rounds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admins_username_key" ON "admins"("username");

-- CreateIndex
CREATE INDEX "devices_house_id_idx" ON "devices"("house_id");

-- CreateIndex
CREATE INDEX "questions_order_index_idx" ON "questions"("order_index");

-- CreateIndex
CREATE INDEX "rounds_question_id_idx" ON "rounds"("question_id");

-- CreateIndex
CREATE INDEX "rounds_locked_house_id_idx" ON "rounds"("locked_house_id");

-- CreateIndex
CREATE INDEX "rounds_locked_at_idx" ON "rounds"("locked_at");

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "houses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_locked_house_id_fkey" FOREIGN KEY ("locked_house_id") REFERENCES "houses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
