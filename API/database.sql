-- =============================================
-- SCHOOLSYSTEMA - OFFICIAL COMPLETE DATABASE SCRIPT
-- All tables, stored procedures, and safety checks
-- Run once to initialize the database
-- =============================================

USE master;
GO

IF DB_ID('school') IS NULL
BEGIN
    CREATE DATABASE school;
    PRINT 'Database [school] created.';
END
GO

USE school;
GO

-- ===================================
-- TABLES (safe creation with checks)
-- ===================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'users')
BEGIN
    CREATE TABLE users (
        id BIGINT IDENTITY PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        is_active BIT DEFAULT 1,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE(),
        CONSTRAINT chk_email CHECK (email LIKE '%@%.%'),
        CONSTRAINT CK_users_role CHECK (role IN ('superadmin','admin','teacher','student','parent'))
    );
    PRINT 'users created';
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'schools')
BEGIN
    CREATE TABLE schools (
        id BIGINT IDENTITY PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        address NVARCHAR(MAX),
        phone VARCHAR(50),
        logo NVARCHAR(MAX),
        plan_type VARCHAR(50) DEFAULT 'starter',
        storage_limit_gb INT DEFAULT 50,
        subscription_start DATE,
        subscription_end DATE,
        created_by BIGINT NOT NULL,
        created_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (created_by) REFERENCES users(id)
    );
    PRINT 'schools created';
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'admins')
BEGIN
    CREATE TABLE admins (
        id BIGINT IDENTITY PRIMARY KEY,
        user_id BIGINT UNIQUE NOT NULL,
        school_id BIGINT UNIQUE NOT NULL,
        created_by BIGINT NOT NULL,
        created_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id)
    );
    PRINT 'admins created';
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'teachers')
BEGIN
    CREATE TABLE teachers (
        id BIGINT IDENTITY PRIMARY KEY,
        user_id BIGINT UNIQUE NOT NULL,
        school_id BIGINT NOT NULL,
        logo NVARCHAR(MAX),
        address NVARCHAR(MAX),
        joinDate VARCHAR(100) DEFAULT '',
        employee_id VARCHAR(50) UNIQUE,
        department VARCHAR(100),
        created_by BIGINT NOT NULL,
        created_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (school_id) REFERENCES schools(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
    );
    PRINT 'teachers created';
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'classes')
BEGIN
    CREATE TABLE classes (
        id BIGINT IDENTITY PRIMARY KEY,
        school_id BIGINT NOT NULL,
        grade VARCHAR(10) NOT NULL,
        section CHAR(3) NOT NULL,
        academic_year VARCHAR(9) DEFAULT '2025-2026',
        class_teacher_id BIGINT,
        created_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (school_id) REFERENCES schools(id),
        FOREIGN KEY (class_teacher_id) REFERENCES teachers(id)
    );
    PRINT 'classes created';
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'class_archives')
BEGIN
    CREATE TABLE class_archives (
        id BIGINT IDENTITY PRIMARY KEY,
        class_id BIGINT NOT NULL UNIQUE,
        school_id BIGINT NOT NULL,
        archived_by BIGINT NULL,
        reason NVARCHAR(255) NULL,
        archived_at DATETIME NOT NULL DEFAULT GETDATE(),
        FOREIGN KEY (class_id) REFERENCES classes(id),
        FOREIGN KEY (school_id) REFERENCES schools(id)
    );
    PRINT 'class_archives created';
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'subjects')
BEGIN
    CREATE TABLE subjects (
        id BIGINT IDENTITY PRIMARY KEY,
        school_id BIGINT NOT NULL,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(20),
        created_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (school_id) REFERENCES schools(id)
    );
    PRINT 'subjects created';
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'class_subjects')
BEGIN
    CREATE TABLE class_subjects (
        id BIGINT IDENTITY PRIMARY KEY,
        class_id BIGINT NOT NULL,
        subject_id BIGINT NOT NULL,
        teacher_id BIGINT NOT NULL,
        UNIQUE (class_id, subject_id),
        FOREIGN KEY (class_id) REFERENCES classes(id),
        FOREIGN KEY (subject_id) REFERENCES subjects(id),
        FOREIGN KEY (teacher_id) REFERENCES teachers(id)
    );
    PRINT 'class_subjects created';
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'students')
BEGIN
    CREATE TABLE students (
        id BIGINT IDENTITY PRIMARY KEY,
        school_id BIGINT NOT NULL,
        class_id BIGINT NOT NULL,
        admission_no VARCHAR(50) UNIQUE NOT NULL,
        roll_number INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        gender VARCHAR(10) CHECK (gender IN ('male','female','other')),
        dob DATE,
        guardian_name VARCHAR(255),
        guardian_phone VARCHAR(50),
        address NVARCHAR(MAX),
        fee_status VARCHAR(20),
        logo NVARCHAR(MAX),
        created_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (school_id) REFERENCES schools(id),
        FOREIGN KEY (class_id) REFERENCES classes(id)
    );
    PRINT 'students created';
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'attendance')
BEGIN
    CREATE TABLE attendance (
        id BIGINT IDENTITY PRIMARY KEY,
        student_id BIGINT NOT NULL,
        class_subject_id BIGINT,
        [date] DATE NOT NULL,
        status VARCHAR(20) DEFAULT 'present' CHECK (status IN ('present','absent','late','half_day')),
        marked_by BIGINT NOT NULL,
        remarks NVARCHAR(MAX),
        marked_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (student_id) REFERENCES students(id),
        FOREIGN KEY (class_subject_id) REFERENCES class_subjects(id),
        FOREIGN KEY (marked_by) REFERENCES teachers(id)
    );
    PRINT 'attendance created';
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'assignments')
BEGIN
    CREATE TABLE assignments (
        id BIGINT IDENTITY PRIMARY KEY,
        school_id BIGINT NOT NULL,
        class_subject_id BIGINT NOT NULL,
        title NVARCHAR(255) NOT NULL,
        description NVARCHAR(MAX),
        due_date DATETIME NOT NULL,
        max_score DECIMAL(5,2) DEFAULT 100,
        created_by BIGINT NOT NULL,
        created_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (school_id) REFERENCES schools(id),
        FOREIGN KEY (class_subject_id) REFERENCES class_subjects(id),
        FOREIGN KEY (created_by) REFERENCES teachers(id)
    );
    PRINT 'assignments created';
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'assignment_submissions')
BEGIN
    CREATE TABLE assignment_submissions (
        id BIGINT IDENTITY PRIMARY KEY,
        assignment_id BIGINT NOT NULL,
        student_id BIGINT NOT NULL,
        file_url NVARCHAR(MAX),
        text_content NVARCHAR(MAX),
        score DECIMAL(5,2),
        feedback NVARCHAR(MAX),
        status VARCHAR(20) DEFAULT 'submitted' CHECK (status IN ('submitted','graded','late')),
        submitted_at DATETIME DEFAULT GETDATE(),
        graded_at DATETIME NULL,
        UNIQUE (assignment_id, student_id),
        FOREIGN KEY (assignment_id) REFERENCES assignments(id),
        FOREIGN KEY (student_id) REFERENCES students(id)
    );
    PRINT 'assignment_submissions created';
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'announcements')
BEGIN
    CREATE TABLE announcements (
        id BIGINT IDENTITY PRIMARY KEY,
        school_id BIGINT NOT NULL,
        title NVARCHAR(255) NOT NULL,
        message NVARCHAR(MAX) NOT NULL,
        type VARCHAR(20) DEFAULT 'info' CHECK (type IN ('info','alert','success')),
        created_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (school_id) REFERENCES schools(id)
    );
    PRINT 'announcements created';
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'leave_requests')
BEGIN
    CREATE TABLE leave_requests (
        id BIGINT IDENTITY PRIMARY KEY,
        school_id BIGINT NOT NULL,
        user_id BIGINT NOT NULL,
        user_role VARCHAR(20) NOT NULL CHECK (user_role IN ('student','teacher')),
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        reason NVARCHAR(MAX) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
        comment NVARCHAR(MAX),
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (school_id) REFERENCES schools(id)
    );
    PRINT 'leave_requests created';
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'parents')
BEGIN
    CREATE TABLE parents (
        id BIGINT IDENTITY PRIMARY KEY,
        user_id BIGINT UNIQUE NOT NULL,
        school_id BIGINT NOT NULL,
        phone VARCHAR(50),
        address NVARCHAR(MAX),
        created_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (school_id) REFERENCES schools(id)
    );
    PRINT 'parents created';
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'parent_students')
BEGIN
    CREATE TABLE parent_students (
        id BIGINT IDENTITY PRIMARY KEY,
        parent_id BIGINT NOT NULL,
        student_id BIGINT NOT NULL,
        relationship VARCHAR(50) DEFAULT 'guardian',
        created_at DATETIME DEFAULT GETDATE(),
        UNIQUE (parent_id, student_id),
        FOREIGN KEY (parent_id) REFERENCES parents(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );
    PRINT 'parent_students created';
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'plans')
BEGIN
    CREATE TABLE plans (
        id BIGINT IDENTITY PRIMARY KEY,
        name VARCHAR(50) NOT NULL UNIQUE,
        price_cents INT NOT NULL,
        stripe_price_id VARCHAR(100),
        storage_limit_gb INT DEFAULT 50,
        max_students INT DEFAULT 1000,
        created_at DATETIME DEFAULT GETDATE()
    );
    PRINT 'plans created';
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'stripe_customers')
BEGIN
    CREATE TABLE stripe_customers (
        id BIGINT IDENTITY PRIMARY KEY,
        school_id BIGINT NOT NULL UNIQUE,
        stripe_customer_id VARCHAR(100) NOT NULL UNIQUE,
        created_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (school_id) REFERENCES schools(id)
    );
    PRINT 'stripe_customers created';
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'subscriptions')
BEGIN
    CREATE TABLE subscriptions (
        id BIGINT IDENTITY PRIMARY KEY,
        school_id BIGINT NOT NULL,
        plan_id BIGINT NULL,
        stripe_subscription_id VARCHAR(100),
        status VARCHAR(30) DEFAULT 'active',
        current_period_start DATETIME NULL,
        current_period_end DATETIME NULL,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (school_id) REFERENCES schools(id),
        FOREIGN KEY (plan_id) REFERENCES plans(id)
    );
    PRINT 'subscriptions created';
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'audit_logs')
BEGIN
    CREATE TABLE audit_logs (
        id BIGINT IDENTITY PRIMARY KEY,
        user_id BIGINT NULL,
        role VARCHAR(20) NULL,
        action VARCHAR(50) NOT NULL,
        entity VARCHAR(50) NULL,
        entity_id VARCHAR(50) NULL,
        ip_address VARCHAR(50) NULL,
        user_agent NVARCHAR(255) NULL,
        metadata NVARCHAR(MAX) NULL,
        created_at DATETIME DEFAULT GETDATE()
    );
    PRINT 'audit_logs created';
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'report_downloads')
BEGIN
    CREATE TABLE report_downloads (
        id BIGINT IDENTITY PRIMARY KEY,
        school_id BIGINT NOT NULL,
        report_type VARCHAR(50) NOT NULL,
        file_name NVARCHAR(255) NOT NULL,
        created_by BIGINT NULL,
        created_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (school_id) REFERENCES schools(id)
    );
    PRINT 'report_downloads created';
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'grades')
BEGIN
    CREATE TABLE grades (
        id BIGINT IDENTITY PRIMARY KEY,
        student_id BIGINT NOT NULL,
        subject VARCHAR(100) NOT NULL,
        term VARCHAR(50) NOT NULL,
        score DECIMAL(5,2) NOT NULL,
        max_score DECIMAL(5,2) NOT NULL DEFAULT 100,
        created_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (student_id) REFERENCES students(id)
    );
    PRINT 'grades created';
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'class_schedule')
BEGIN
    CREATE TABLE class_schedule (
        id BIGINT IDENTITY PRIMARY KEY,
        class_subject_id BIGINT NOT NULL,
        day_of_week VARCHAR(20) NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        room VARCHAR(50) NULL,
        created_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (class_subject_id) REFERENCES class_subjects(id)
    );
    PRINT 'class_schedule created';
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'fees_invoices')
BEGIN
    CREATE TABLE fees_invoices (
        id BIGINT IDENTITY PRIMARY KEY,
        school_id BIGINT NOT NULL,
        student_id BIGINT NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        due_date DATE,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('paid','pending','overdue')),
        created_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (school_id) REFERENCES schools(id),
        FOREIGN KEY (student_id) REFERENCES students(id)
    );
    PRINT 'fees_invoices created';
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'student_users')
BEGIN
    CREATE TABLE student_users (
        id BIGINT IDENTITY PRIMARY KEY,
        user_id BIGINT NOT NULL UNIQUE,
        student_id BIGINT NOT NULL UNIQUE,
        school_id BIGINT NOT NULL,
        created_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );
    PRINT 'student_users created';
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'notification_templates')
BEGIN
    CREATE TABLE notification_templates (
        id BIGINT IDENTITY PRIMARY KEY,
        school_id BIGINT NOT NULL,
        name NVARCHAR(100) NOT NULL,
        channel VARCHAR(20) NOT NULL CHECK (channel IN ('in_app','email','sms','whatsapp')),
        title_template NVARCHAR(255) NULL,
        message_template NVARCHAR(MAX) NOT NULL,
        is_active BIT DEFAULT 1,
        created_by BIGINT NULL,
        created_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (school_id) REFERENCES schools(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
    );
    PRINT 'notification_templates created';
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'notifications')
BEGIN
    CREATE TABLE notifications (
        id BIGINT IDENTITY PRIMARY KEY,
        school_id BIGINT NOT NULL,
        recipient_type VARCHAR(20) NOT NULL CHECK (recipient_type IN ('school','student','teacher','admin')),
        recipient_id BIGINT NULL,
        channel VARCHAR(20) NOT NULL CHECK (channel IN ('in_app','email','sms','whatsapp')),
        title NVARCHAR(255) NULL,
        message NVARCHAR(MAX) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed','cancelled','read')),
        scheduled_at DATETIME NULL,
        sent_at DATETIME NULL,
        read_at DATETIME NULL,
        attempts INT NOT NULL DEFAULT 0,
        last_attempt_at DATETIME NULL,
        next_retry_at DATETIME NULL,
        provider_message_id NVARCHAR(255) NULL,
        error_message NVARCHAR(MAX) NULL,
        metadata NVARCHAR(MAX) NULL,
        template_id BIGINT NULL,
        entity_type VARCHAR(50) NULL,
        entity_id BIGINT NULL,
        created_by BIGINT NULL,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (school_id) REFERENCES schools(id),
        FOREIGN KEY (template_id) REFERENCES notification_templates(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
    );
    PRINT 'notifications created';
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'chat_conversations')
BEGIN
    CREATE TABLE chat_conversations (
        id BIGINT IDENTITY PRIMARY KEY,
        school_id BIGINT NOT NULL,
        parent_user_id BIGINT NULL,
        teacher_id BIGINT NOT NULL,
        student_id BIGINT NOT NULL,
        guardian_name NVARCHAR(255) NULL,
        guardian_phone VARCHAR(50) NULL,
        created_by BIGINT NULL,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE(),
        CONSTRAINT UQ_chat_conversations UNIQUE (school_id, parent_user_id, teacher_id, student_id),
        CONSTRAINT CK_chat_conversations_parent_target CHECK (
            parent_user_id IS NOT NULL
            OR NULLIF(LTRIM(RTRIM(guardian_phone)), '') IS NOT NULL
        ),
        FOREIGN KEY (school_id) REFERENCES schools(id),
        FOREIGN KEY (parent_user_id) REFERENCES users(id),
        FOREIGN KEY (teacher_id) REFERENCES teachers(id),
        FOREIGN KEY (student_id) REFERENCES students(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
    );
    PRINT 'chat_conversations created';
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'chat_messages')
BEGIN
    CREATE TABLE chat_messages (
        id BIGINT IDENTITY PRIMARY KEY,
        conversation_id BIGINT NOT NULL,
        school_id BIGINT NOT NULL,
        sender_user_id BIGINT NOT NULL,
        sender_role VARCHAR(20) NOT NULL CHECK (sender_role IN ('parent','teacher')),
        message_type VARCHAR(20) NOT NULL CHECK (message_type IN ('text','file')),
        message_text NVARCHAR(MAX) NULL,
        file_url NVARCHAR(500) NULL,
        file_name NVARCHAR(255) NULL,
        file_mime_type VARCHAR(255) NULL,
        file_size_bytes BIGINT NULL,
        read_at DATETIME NULL,
        deleted_at DATETIME NULL,
        created_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id),
        FOREIGN KEY (school_id) REFERENCES schools(id),
        FOREIGN KEY (sender_user_id) REFERENCES users(id)
    );
    PRINT 'chat_messages created';
END

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'notifications')
BEGIN
    IF COL_LENGTH('notifications', 'attempts') IS NULL
        ALTER TABLE notifications ADD attempts INT NOT NULL CONSTRAINT DF_notifications_attempts DEFAULT 0;
    IF COL_LENGTH('notifications', 'last_attempt_at') IS NULL
        ALTER TABLE notifications ADD last_attempt_at DATETIME NULL;
    IF COL_LENGTH('notifications', 'next_retry_at') IS NULL
        ALTER TABLE notifications ADD next_retry_at DATETIME NULL;
    IF COL_LENGTH('notifications', 'provider_message_id') IS NULL
        ALTER TABLE notifications ADD provider_message_id NVARCHAR(255) NULL;
    IF COL_LENGTH('notifications', 'updated_at') IS NULL
        ALTER TABLE notifications ADD updated_at DATETIME NOT NULL CONSTRAINT DF_notifications_updated_at DEFAULT GETDATE();
    IF COL_LENGTH('notifications', 'read_at') IS NULL
        ALTER TABLE notifications ADD read_at DATETIME NULL;
END

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'users')
BEGIN
    DECLARE @dropRoleChecksSql NVARCHAR(MAX) = N'';
    SELECT @dropRoleChecksSql = @dropRoleChecksSql + N'ALTER TABLE users DROP CONSTRAINT [' + cc.name + N'];'
    FROM sys.check_constraints cc
    WHERE cc.parent_object_id = OBJECT_ID('users')
      AND cc.definition LIKE '%role%';

    IF LEN(@dropRoleChecksSql) > 0
        EXEC sp_executesql @dropRoleChecksSql;

    IF NOT EXISTS (
        SELECT 1
        FROM sys.check_constraints
        WHERE parent_object_id = OBJECT_ID('users')
          AND name = 'CK_users_role'
    )
        ALTER TABLE users
        ADD CONSTRAINT CK_users_role CHECK (role IN ('superadmin','admin','teacher','student','parent'));

    IF EXISTS (
        SELECT 1
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'phone' AND CHARACTER_MAXIMUM_LENGTH < 50
    )
        ALTER TABLE users ALTER COLUMN phone VARCHAR(50) NULL;
END

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'schools')
BEGIN
    IF EXISTS (
        SELECT 1
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'schools' AND COLUMN_NAME = 'phone' AND CHARACTER_MAXIMUM_LENGTH < 50
    )
        ALTER TABLE schools ALTER COLUMN phone VARCHAR(50) NULL;
END

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'students')
BEGIN
    IF EXISTS (
        SELECT 1
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'students' AND COLUMN_NAME = 'guardian_phone' AND CHARACTER_MAXIMUM_LENGTH < 50
    )
        ALTER TABLE students ALTER COLUMN guardian_phone VARCHAR(50) NULL;
END

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'chat_conversations')
BEGIN
    IF COL_LENGTH('chat_conversations', 'guardian_name') IS NULL
        ALTER TABLE chat_conversations ADD guardian_name NVARCHAR(255) NULL;
    IF COL_LENGTH('chat_conversations', 'guardian_phone') IS NULL
        ALTER TABLE chat_conversations ADD guardian_phone VARCHAR(50) NULL;

    IF EXISTS (
        SELECT 1
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'chat_conversations'
          AND COLUMN_NAME = 'parent_user_id'
          AND IS_NULLABLE = 'NO'
    )
        ALTER TABLE chat_conversations ALTER COLUMN parent_user_id BIGINT NULL;

    IF EXISTS (
        SELECT 1
        FROM sys.check_constraints
        WHERE parent_object_id = OBJECT_ID('chat_conversations')
          AND name = 'CK_chat_conversations_parent_target'
    )
        ALTER TABLE chat_conversations DROP CONSTRAINT CK_chat_conversations_parent_target;

    IF NOT EXISTS (
        SELECT 1
        FROM sys.check_constraints
        WHERE parent_object_id = OBJECT_ID('chat_conversations')
          AND name = 'CK_chat_conversations_parent_target'
    )
        ALTER TABLE chat_conversations
        ADD CONSTRAINT CK_chat_conversations_parent_target CHECK (
            parent_user_id IS NOT NULL
            OR NULLIF(LTRIM(RTRIM(guardian_phone)), '') IS NOT NULL
        );
END

-- ===================================
-- INDEXES
-- ===================================
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_students_school')
    CREATE INDEX IX_students_school ON students(school_id);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_students_class')
    CREATE INDEX IX_students_class ON students(class_id);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_attendance_date')
    CREATE INDEX IX_attendance_date ON attendance([date]);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_fees_school')
    CREATE INDEX IX_fees_school ON fees_invoices(school_id);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_announcements_school')
    CREATE INDEX IX_announcements_school ON announcements(school_id);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_subscriptions_school')
    CREATE INDEX IX_subscriptions_school ON subscriptions(school_id);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_audit_logs_user')
    CREATE INDEX IX_audit_logs_user ON audit_logs(user_id);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_report_downloads_school')
    CREATE INDEX IX_report_downloads_school ON report_downloads(school_id);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_grades_student')
    CREATE INDEX IX_grades_student ON grades(student_id);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_schedule_class_subject')
    CREATE INDEX IX_schedule_class_subject ON class_schedule(class_subject_id);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_notification_templates_school')
    CREATE INDEX IX_notification_templates_school ON notification_templates(school_id);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_notifications_school_status')
    CREATE INDEX IX_notifications_school_status ON notifications(school_id, status, created_at);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_notifications_entity')
    CREATE INDEX IX_notifications_entity ON notifications(entity_type, entity_id);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_notifications_retry')
    CREATE INDEX IX_notifications_retry ON notifications(status, next_retry_at, scheduled_at);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_notifications_student_inapp')
    CREATE INDEX IX_notifications_student_inapp ON notifications(school_id, recipient_type, recipient_id, channel, status, created_at);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_student_users_school')
    CREATE INDEX IX_student_users_school ON student_users(school_id, student_id);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_chat_conversations_parent')
    CREATE INDEX IX_chat_conversations_parent ON chat_conversations(parent_user_id, school_id, updated_at);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_chat_conversations_teacher')
    CREATE INDEX IX_chat_conversations_teacher ON chat_conversations(teacher_id, school_id, updated_at);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_chat_conversations_student')
    CREATE INDEX IX_chat_conversations_student ON chat_conversations(student_id, school_id);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_chat_conversations_guardian_phone')
    CREATE INDEX IX_chat_conversations_guardian_phone ON chat_conversations(guardian_phone, school_id, updated_at);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_chat_messages_conversation')
    CREATE INDEX IX_chat_messages_conversation ON chat_messages(conversation_id, created_at);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_chat_messages_sender')
    CREATE INDEX IX_chat_messages_sender ON chat_messages(sender_user_id, created_at);

IF COL_LENGTH('students', 'logo') IS NULL
    ALTER TABLE students ADD logo NVARCHAR(MAX) NULL;
IF COL_LENGTH('students', 'fee_status') IS NULL
    ALTER TABLE students ADD fee_status VARCHAR(20) NULL;

PRINT 'Indexes created';

-- ===================================
-- STORED PROCEDURES
-- ===================================

GO
CREATE OR ALTER PROCEDURE GETALLSCHOOL
AS
BEGIN
    SELECT 
        s.id AS school_id, 
        s.name AS school_name, 
        s.address, 
        s.logo,
        s.plan_type, 
        s.storage_limit_gb, 
        s.subscription_start,
        s.subscription_end, 
        ISNULL(st.total_students,0) AS student_count,
        u.name AS principal_name, 
        u.email AS principal_email,
        u.is_active AS status, 
        u.phone, 
        u.id AS user_id
    FROM schools s
    LEFT JOIN admins a ON s.id = a.school_id
    LEFT JOIN users u ON a.user_id = u.id
    LEFT JOIN (
        SELECT school_id, COUNT(*) AS total_students 
        FROM students 
        GROUP BY school_id
    ) st ON s.id = st.school_id
    ORDER BY s.name;
END;
GO

CREATE OR ALTER PROCEDURE UpdateSchoolAndUser
    @school_id INT,
    @address NVARCHAR(255),
    @logo NVARCHAR(MAX),
    @phone VARCHAR(50),
    @school_name VARCHAR(100),
    @plan_type VARCHAR(50),
    @storage_limit_gb INT,
    @user_id INT,
    @user_email VARCHAR(255),
    @user_name VARCHAR(255),
    @user_phone VARCHAR(50),
    @is_active INT
AS
BEGIN
    BEGIN TRY
        BEGIN TRAN
            UPDATE schools 
            SET address = @address,
                logo = @logo,
                phone = @phone,
                name = @school_name,
                plan_type = @plan_type,
                storage_limit_gb = @storage_limit_gb
            WHERE id = @school_id;

            UPDATE users 
            SET email = @user_email,
                name = @user_name,
                phone = @user_phone,
                is_active = CASE WHEN @is_active = 1 THEN 1 ELSE 0 END,
                updated_at = GETDATE()
            WHERE id = @user_id;
        COMMIT
    END TRY
    BEGIN CATCH
        ROLLBACK;
        THROW;
    END CATCH;
END;
GO

CREATE OR ALTER PROCEDURE SP_GETCLASSESFORADMIN 
    @school_id INT
AS
BEGIN
    SELECT 
        u.name AS teacher_name,
        c.id,
        c.school_id,
        c.grade,
        c.academic_year,
        c.class_teacher_id,
        c.section
    FROM classes c
    LEFT JOIN teachers t ON t.id = c.class_teacher_id
    LEFT JOIN users u ON u.id = t.user_id
    WHERE c.school_id = @school_id
    ORDER BY c.grade, c.section;
END;
GO

CREATE OR ALTER PROCEDURE SP_CREATECLASS
    @school_id INT,
    @grade VARCHAR(50),
    @section VARCHAR(50),
    @year VARCHAR(20),
    @teacher INT
AS
BEGIN
    INSERT INTO classes (school_id, grade, section, academic_year, class_teacher_id)
    VALUES (@school_id, @grade, @section, @year, @teacher);
    
    SELECT SCOPE_IDENTITY() AS id;
END;
GO

PRINT 'Database initialization complete.';
PRINT 'All tables, indexes, and stored procedures are ready.';
GO
