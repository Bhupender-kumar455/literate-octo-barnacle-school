# School Admin and Teacher Attendance Guide

This guide explains:
- How `School Admin` creates classes and assigns teachers.
- How `Teacher` takes attendance.

## Where Student Is Assigned to Class

Student-to-class mapping is done in these flows:

1. `Add New Student` form  
   - Admin selects `Class` while creating a student.
   - This saves `students.class_id`.

2. `Bulk Import Students`  
   - Import uses `grade` + `section` from each row to resolve class.
   - If class does not exist, it auto-creates the class and then assigns the student to it.

Note:
- There is currently no separate UI screen called "Assign Student to Class".
- Reassignment is supported in backend via `PUT /api/admin/students/:id` with `class_id`, but current profile edit UI does not expose class change yet.

## 1) School Admin: Create Teacher Profile

1. Login as `School Admin`.
2. Open sidebar `Teachers`.
3. Click `Add Teacher`.
4. Fill at least:
   - `Full Name`
   - `Email Address`
   - `Password`
5. Optional but recommended:
   - `Phone Number`
   - `Subject Specialization`
   - `Home Address`
   - `Join Date`
   - `Status`
6. Click `Create Teacher Profile`.

## 2) School Admin: Create Class + Subject Setup (One Step, Recommended)

1. Open sidebar `Classes`.
2. Click `Create Class`.
3. Fill class basics:
   - `Grade Level` (example: `10`)
   - `Section` (example: `A`)
   - `Academic Year` (example: `2025-2026`)
   - `Class Teacher` (select teacher)
   - `Room Number` (optional)
4. In `Quick Subject Setup`, keep `Enable` ON.
5. Choose:
   - `Subject Type` (`Use Existing Subject` or `Create New Subject`)
   - `Subject`
   - `Subject Teacher`
6. Optional: enable `Add first schedule entry now` and fill day/time/room.
7. Click `Save Class Setup`.

Result:
- Class is created.
- Class teacher is assigned.
- Subject and subject-teacher mapping are assigned in the same flow.
- Optional first schedule is added.

## 3) School Admin: Assign Subject + Teacher to Class (Alternative Manual Flow)

1. In `Classes`, click `Add Subject` (if subject does not exist yet).
2. Save subject.
3. Click `Assign Subject`.
4. Select:
   - `Class`
   - `Subject`
   - `Teacher`
5. Click `Assign`.

Result:
- A `Class Subject` mapping is created (`class + subject + teacher`).
- This mapping is important for teacher timetable and attendance context.

## 4) School Admin: Add Class Schedule (Alternative Manual Flow)

1. In `Classes`, click `Add Schedule`.
2. Select:
   - `Class Subject`
   - `Day`
   - `Start Time`
   - `End Time`
   - `Room` (optional)
3. Click `Save`.

Result:
- Teacher gets today timetable entries.
- `Start Class and Take Attendance` uses this schedule context.

## 5) Teacher: Take Attendance

1. Login as `Teacher`.
2. On dashboard, click `Start Class and Take Attendance`.
3. For each student, mark status:
   - `P` = Present
   - `A` = Absent
   - `L` = Late
4. Optional: add notes in `Remarks`.
5. Optional shortcut: click `Mark All Present`.
6. Click `Submit Attendance`.

Result:
- Attendance is saved for the current date.
- Existing row is updated if already marked for same student/date/class-subject.

## 6) Verify Attendance (Teacher)

1. Open sidebar `History`.
2. Use date filters if needed.
3. Confirm entries are visible with:
   - student name
   - class/subject
   - status
   - remarks

## 7) Common Setup Issues

- Teacher cannot see proper class context in attendance:
  - Ensure `Class Subject` is assigned to that teacher.
  - Ensure `Schedule` exists for that class subject/day.

- Attendance errors like invalid class subject:
  - Happens when selected `class_subject_id` is not assigned to logged-in teacher.

- No students visible for teacher:
  - Ensure students are created and mapped to classes.
  - Ensure class is connected to teacher via class subject and/or class teacher.
