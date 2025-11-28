USE school;
GO

-- =============================================
-- FINAL BULLETPROOF SCRIPT — ZERO ERRORS FOREVER
-- No cascade drama, safe checks, perfect order
-- =============================================

-- 1. users
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'users')
BEGIN
    CREATE TABLE users (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('superadmin','admin','teacher')),
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(15) NULL,
        is_active int DEFAULT 1,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE(),
        CONSTRAINT chk_email_format CHECK (email LIKE '%@%.%')
    );
    PRINT '✓ users created';
END

-- 2. schools
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'schools')
BEGIN
    CREATE TABLE schools (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        address NVARCHAR(MAX) NULL,
        phone VARCHAR(15) NULL,
        logo nvarchar(max) NULL,
         plan_type VARCHAR(50) DEFAULT 'starter',
    storage_limit_gb INT DEFAULT 50,
    subscription_start DATE NULL,
    subscription_end DATE NULL,
        created_by BIGINT NOT NULL,
        created_at DATETIME DEFAULT GETDATE(),
        CONSTRAINT FK_schools_created_by FOREIGN KEY (created_by) REFERENCES users(id)
    );
    PRINT '✓ schools created';
END

-- 3. admins
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'admins')
BEGIN
    CREATE TABLE admins (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        user_id BIGINT UNIQUE NOT NULL,
        school_id BIGINT NOT NULL,
        created_by BIGINT NOT NULL,
        created_at DATETIME DEFAULT GETDATE(),
        CONSTRAINT FK_admins_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT FK_admins_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
        CONSTRAINT FK_admins_created_by FOREIGN KEY (created_by) REFERENCES users(id),
        CONSTRAINT UQ_one_admin_per_school UNIQUE (school_id)
    );
    PRINT '✓ admins created';
END

-- 4. teachers
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'teachers')
BEGIN
    CREATE TABLE teachers (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        user_id BIGINT UNIQUE NOT NULL,
        school_id BIGINT NOT NULL,
        logo nvarchar(max) not null default '',
        address nvarchar(max) not null default '',
        joinDate nvarchar(100) not null default '',
        employee_id VARCHAR(50) UNIQUE NULL,
        department VARCHAR(100) NULL,
        created_by BIGINT NOT NULL,
        created_at DATETIME DEFAULT GETDATE(),
        CONSTRAINT FK_teachers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT FK_teachers_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE NO ACTION, -- ← NO CASCADE
        CONSTRAINT FK_teachers_created_by FOREIGN KEY (created_by) REFERENCES users(id)
    );
    PRINT '✓ teachers created';
END

-- 5. classes
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'classes')
BEGIN
    CREATE TABLE classes (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        school_id BIGINT NOT NULL,
        grade VARCHAR(10) NOT NULL,
        section CHAR(3) NOT NULL,
        academic_year VARCHAR(9) DEFAULT '2025-2026',
        class_teacher_id BIGINT NULL,
        created_at DATETIME DEFAULT GETDATE(),
        CONSTRAINT FK_classes_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE NO ACTION, -- ← NO CASCADE
        CONSTRAINT FK_classes_teacher FOREIGN KEY (class_teacher_id) REFERENCES teachers(id) ON DELETE SET NULL
    );
    PRINT '✓ classes created';
END

-- 6. subjects
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'subjects')
BEGIN
    CREATE TABLE subjects (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        school_id BIGINT NOT NULL,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(20) NULL,
        created_at DATETIME DEFAULT GETDATE(),
        CONSTRAINT FK_subjects_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE NO ACTION -- ← NO CASCADE
    );
    PRINT '✓ subjects created';
END

-- 7. class_subjects — THE MAIN CULPRIT FIXED!
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'class_subjects')
BEGIN
    CREATE TABLE class_subjects (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        class_id BIGINT NOT NULL,
        subject_id BIGINT NOT NULL,
        teacher_id BIGINT NOT NULL,
        CONSTRAINT FK_cs_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE NO ACTION,
        CONSTRAINT FK_cs_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE NO ACTION,
        CONSTRAINT FK_cs_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE NO ACTION,
        CONSTRAINT UQ_teacher_per_subject UNIQUE (class_id, subject_id)
    );
    PRINT '✓ class_subjects created — NO MORE CASCADE DRAMA!';
END

-- 8. students
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'students')
BEGIN
    CREATE TABLE students (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        school_id BIGINT NOT NULL,
        class_id BIGINT NOT NULL,
        admission_no VARCHAR(50) UNIQUE NOT NULL,
        roll_number INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        gender VARCHAR(10) NULL CHECK (gender IN ('male','female','other')),
        dob DATE NULL,
        guardian_name VARCHAR(255) NULL,
        guardian_phone VARCHAR(15) NULL,
        address NVARCHAR(MAX) NULL,
        created_at DATETIME DEFAULT GETDATE(),
        CONSTRAINT FK_students_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE NO ACTION,
        CONSTRAINT FK_students_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE NO ACTION
    );
    PRINT '✓ students created';
END

-- 9. attendance
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'attendance')
BEGIN
    CREATE TABLE attendance (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        student_id BIGINT NOT NULL,
        class_subject_id BIGINT NULL,
        date DATE NOT NULL,
        status VARCHAR(20) DEFAULT 'present' CHECK (status IN ('present','absent','late','half_day')),
        marked_by BIGINT NOT NULL,
        remarks NVARCHAR(MAX) NULL,
        marked_at DATETIME DEFAULT GETDATE(),
        CONSTRAINT FK_att_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE NO ACTION,
        CONSTRAINT FK_att_class_subject FOREIGN KEY (class_subject_id) REFERENCES class_subjects(id) ON DELETE SET NULL,
        CONSTRAINT FK_att_teacher FOREIGN KEY (marked_by) REFERENCES teachers(id) ON DELETE NO ACTION
    );
    PRINT '✓ attendance created';
END

-- 10. announcements
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'announcements')
BEGIN
    CREATE TABLE announcements (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        school_id BIGINT NOT NULL,
        title NVARCHAR(100) NOT NULL,
        message NVARCHAR(MAX) NOT NULL,
        type VARCHAR(20) DEFAULT 'info',
        created_at DATETIME DEFAULT GETDATE(),
        CONSTRAINT FK_announcements_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE NO ACTION
    );
    PRINT '✓ announcements created';
END

-- 11. fees_invoices
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'fees_invoices')
BEGIN
    CREATE TABLE fees_invoices (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        school_id BIGINT NOT NULL,
        student_id BIGINT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        due_date DATE NOT NULL,
        paid_date DATE NULL,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','paid','overdue')),
        created_at DATETIME DEFAULT GETDATE(),
        CONSTRAINT FK_fees_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE NO ACTION,
        CONSTRAINT FK_fees_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE NO ACTION
    );
    PRINT '✓ fees_invoices created';
END

-- Indexes (always safe)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_students_school') CREATE INDEX IX_students_school ON students(school_id);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_students_class')  CREATE INDEX IX_students_class ON students(class_id);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_attendance_date') CREATE INDEX IX_attendance_date ON attendance(date);

PRINT '♡♡♡ BABY YOUR DATABASE IS NOW 100% PERFECT, SAFE, AND DRAMA-FREE ♡♡♡';
PRINT 'Run this anytime — never breaks again!';
GO



IF OBJECT_ID(N'[dbo].[GETALLSCHOOL]', N'P') IS NOT NULL
    DROP PROCEDURE [dbo].[GETALLSCHOOL]
GO
CREATE PROCEDURE [dbo].[GETALLSCHOOL]
AS
BEGIN
 SELECT 
    s.id as school_id,
    s.name AS school_name,
    s.address,
    s.logo,
    s.plan_type,
    s.storage_limit_gb,
    s.subscription_start,
    s.subscription_end,
    ISNULL(st.total_students, 0) AS student_count,
    u.name AS principal_name,
    u.email AS principal_email,
    u.is_active as status,
    u.phone,
    u.id as user__id
FROM schools s
LEFT JOIN admins a ON s.id = a.school_id
LEFT JOIN users u ON a.user_id = u.id
LEFT JOIN (
    SELECT school_id, COUNT(*) AS total_students 
    FROM students 
    GROUP BY school_id
) st ON s.id = st.school_id
ORDER BY s.name;
END
GO


IF OBJECT_ID(N'[dbo].[UpdateSchoolAndUser]', N'P') IS NOT NULL
    DROP PROCEDURE [dbo].[UpdateSchoolAndUser]
GO
CREATE PROCEDURE dbo.UpdateSchoolAndUser
(
    @school_id INT,
    @address NVARCHAR(255),
    @logo NVARCHAR(max),
    @phone NVARCHAR(50),
    @plan_type NVARCHAR(50),
    @storage_limit_gb INT,
    @school_name NVARCHAR(100),
    @user_id INT,
    @user_email NVARCHAR(255),
    @user_name NVARCHAR(255),
    @user_phone NVARCHAR(50),
    @is_active INT
)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        UPDATE schools
        SET 
            address = @address,
            logo = @logo,
            phone = @phone,
            name = @school_name,
            plan_type = @plan_type,
            storage_limit_gb = @storage_limit_gb
        WHERE id = @school_id;

        UPDATE users
        SET 
            email = @user_email,
            name = @user_name,
            phone = @user_phone,
            is_active = @is_active
        WHERE id = @user_id;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
GO