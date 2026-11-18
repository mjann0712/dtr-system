<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // HR employee records. Only what the DTR needs: no government IDs,
        // birthdates, addresses or emergency contacts.
        Schema::create('employees', function (Blueprint $table) {
            $table->id();
            $table->string('employee_id', 40)->unique();      // e.g. CE-695
            $table->string('last_name', 80);
            $table->string('first_name', 120)->default('');
            $table->string('name', 210)->index();              // "LAST, FIRST M."
            $table->string('position', 160)->default('');
            $table->string('department', 40)->nullable()->index();
            $table->string('department_source', 20)->nullable(); // file | position | biometric | manual
            $table->string('gender', 10)->nullable();
            $table->date('date_hired')->nullable();
            $table->string('status', 10)->default('Active')->index(); // Active | Inactive
            $table->timestamps();
        });

        // Biometric (time-clock) AC-No. -> employee. One employee may have several.
        Schema::create('biometric_ids', function (Blueprint $table) {
            $table->id();
            $table->string('ac_no', 20)->unique();
            $table->foreignId('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->timestamps();
        });

        // Every AC-No. seen in imports, with the name printed by the time-clock.
        Schema::create('biometric_people', function (Blueprint $table) {
            $table->string('ac_no', 20)->primary();
            $table->string('name', 160)->default('');
            $table->string('department', 40)->nullable();
            $table->boolean('ignored')->default(false);
            $table->timestamps();
        });

        // One row per imported month.
        Schema::create('periods', function (Blueprint $table) {
            $table->id();
            $table->char('period', 7)->unique();               // YYYY-MM
            $table->date('date_from');
            $table->date('date_to');
            $table->string('file_name', 255)->default('');
            $table->unsignedInteger('people')->default(0);
            $table->unsignedInteger('punch_count')->default(0);
            $table->foreignId('imported_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('punches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('period_id')->constrained('periods')->cascadeOnDelete();
            $table->string('ac_no', 20);
            $table->string('name', 160)->default('');
            $table->date('punch_date');
            $table->unsignedSmallInteger('minute');            // minutes after midnight
            $table->string('state', 30)->nullable();
            $table->string('exception', 30)->nullable();
            $table->index(['period_id', 'ac_no']);
        });

        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('key', 60)->unique();
            $table->json('value');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('punches');
        Schema::dropIfExists('periods');
        Schema::dropIfExists('biometric_people');
        Schema::dropIfExists('biometric_ids');
        Schema::dropIfExists('employees');
        Schema::dropIfExists('settings');
    }
};
