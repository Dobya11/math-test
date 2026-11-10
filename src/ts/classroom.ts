import type { User } from "./types.ts";
import { getSupabase } from "./supabase.ts";

export interface Classroom {
  id: string;
  class_code: string;
  grade: 2;
}

export interface Assignment {
  id: string;
  title: string;
  topics: string[];
  questions_per_topic: 4 | 8 | 12;
  total_questions: number;
  created_at: string;
}

export interface AssignmentQuestion {
  id: string;
  position: number;
  topic: string;
  prompt: string;
}

export interface Attempt {
  id: string;
  assignment_id: string;
  student_id: string;
  status: "started" | "completed";
  score: number | null;
  total_questions: number;
  started_at: string;
  completed_at: string | null;
}

export interface ClassMember {
  id: string;
  name: string;
  joined_at: string;
}

export interface TeacherSnapshot {
  classroom: Classroom | null;
  members: ClassMember[];
  assignments: Assignment[];
  attempts: Attempt[];
}

export interface StudentSnapshot {
  classroom: Classroom | null;
  assignments: Assignment[];
  attempts: Attempt[];
}

async function getAssignments(classroomId: string): Promise<Assignment[]> {
  const { data, error } = await getSupabase()
    .from("assignments")
    .select("id,title,topics,questions_per_topic,total_questions,created_at")
    .eq("classroom_id", classroomId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getAccountProfile(userId: string): Promise<User> {
  const { data, error } = await getSupabase()
    .from("profiles")
    .select("id,display_name,role")
    .eq("id", userId)
    .single();
  if (error) throw error;
  if (data.role !== "teacher" && data.role !== "student") {
    throw new Error("У профілі вказано невідому роль.");
  }
  return { id: data.id, name: data.display_name, role: data.role };
}

export async function getTeacherSnapshot(
  teacherId: string,
): Promise<TeacherSnapshot> {
  const client = getSupabase();
  const { data: classroom, error: classroomError } = await client
    .from("classrooms")
    .select("id,class_code,grade")
    .eq("teacher_id", teacherId)
    .maybeSingle();
  if (classroomError) throw classroomError;
  if (!classroom) {
    return { classroom: null, members: [], assignments: [], attempts: [] };
  }

  const [membersResult, assignments] = await Promise.all([
    client
      .from("class_members")
      .select("student_id,joined_at")
      .eq("classroom_id", classroom.id)
      .order("joined_at"),
    getAssignments(classroom.id),
  ]);
  if (membersResult.error) throw membersResult.error;

  const memberRows = membersResult.data ?? [];
  const profileResult =
    memberRows.length > 0
      ? await client
          .from("profiles")
          .select("id,display_name")
          .in(
            "id",
            memberRows.map(({ student_id }) => student_id),
          )
      : { data: [], error: null };
  if (profileResult.error) throw profileResult.error;
  const names = new Map(
    (profileResult.data ?? []).map(({ id, display_name }) => [
      id,
      display_name,
    ]),
  );
  const members = memberRows.map((member) => ({
    id: member.student_id,
    name: names.get(member.student_id) ?? "Учень",
    joined_at: member.joined_at,
  }));

  const attemptResult =
    assignments.length > 0
      ? await client
          .from("attempts")
          .select(
            "id,assignment_id,student_id,status,score,total_questions,started_at,completed_at",
          )
          .in(
            "assignment_id",
            assignments.map(({ id }) => id),
          )
          .order("started_at", { ascending: false })
      : { data: [], error: null };
  if (attemptResult.error) throw attemptResult.error;

  return {
    classroom,
    members,
    assignments,
    attempts: attemptResult.data ?? [],
  };
}

export async function getStudentSnapshot(
  studentId: string,
): Promise<StudentSnapshot> {
  const client = getSupabase();
  const { data: membership, error: membershipError } = await client
    .from("class_members")
    .select("classroom_id")
    .eq("student_id", studentId)
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership) return { classroom: null, assignments: [], attempts: [] };

  const { data: classroom, error: classroomError } = await client
    .from("classrooms")
    .select("id,class_code,grade")
    .eq("id", membership.classroom_id)
    .single();
  if (classroomError) throw classroomError;

  const assignments = await getAssignments(classroom.id);
  const attemptResult =
    assignments.length > 0
      ? await client
          .from("attempts")
          .select(
            "id,assignment_id,student_id,status,score,total_questions,started_at,completed_at",
          )
          .eq("student_id", studentId)
          .in(
            "assignment_id",
            assignments.map(({ id }) => id),
          )
          .order("started_at", { ascending: false })
      : { data: [], error: null };
  if (attemptResult.error) throw attemptResult.error;

  return { classroom, assignments, attempts: attemptResult.data ?? [] };
}

export async function createClassroom(): Promise<void> {
  const { error } = await getSupabase().rpc("create_classroom");
  if (error) throw error;
}

export async function joinClassroom(code: string): Promise<void> {
  const { error } = await getSupabase().rpc("join_class", {
    p_code: code,
  });
  if (error) throw error;
}

export async function createAssignment(input: {
  classroomId: string;
  title: string;
  topics: string[];
  questionsPerTopic: 4 | 8 | 12;
}): Promise<void> {
  const { data, error } = await getSupabase().rpc("create_assignment", {
    p_classroom_id: input.classroomId,
    p_title: input.title.trim(),
    p_topics: input.topics,
    p_questions_per_topic: input.questionsPerTopic,
  });
  if (error) throw error;
  if (typeof data !== "string") {
    throw new Error("Не вдалося створити завдання.");
  }
}

export async function getAssignmentQuestions(
  assignmentId: string,
): Promise<AssignmentQuestion[]> {
  const { data, error } = await getSupabase()
    .from("generated_questions")
    .select("id,position,topic,prompt")
    .eq("assignment_id", assignmentId)
    .order("position");
  if (error) throw error;
  return data ?? [];
}

export async function startAssignmentAttempt(
  assignmentId: string,
): Promise<string> {
  const { data, error } = await getSupabase().rpc("start_assignment_attempt", {
    p_assignment_id: assignmentId,
  });
  if (error) throw error;
  if (typeof data !== "string") {
    throw new Error("Не вдалося почати виконання.");
  }
  return data;
}

export async function submitAssignmentAnswer(
  attemptId: string,
  questionId: string,
  answer: "Правильно" | "Неправильно",
): Promise<boolean> {
  const { data, error } = await getSupabase().rpc("submit_assignment_answer", {
    p_attempt_id: attemptId,
    p_question_id: questionId,
    p_response: answer,
  });
  if (error) throw error;
  if (typeof data !== "boolean") {
    throw new Error("Не вдалося зберегти відповідь.");
  }
  return data;
}

export async function completeAssignmentAttempt(
  attemptId: string,
): Promise<void> {
  const { error } = await getSupabase().rpc("complete_assignment_attempt", {
    p_attempt_id: attemptId,
  });
  if (error) throw error;
}

export function subscribeToClassChanges(
  onChange: () => void,
  onError: (message: string) => void,
) {
  const client = getSupabase();
  const channel = client
    .channel(`classroom-updates-${crypto.randomUUID()}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "class_members" },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "assignments" },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "attempts" },
      onChange,
    )
    .subscribe((status, error) => {
      if (status === "SUBSCRIBED") {
        onChange();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        onError(
          error?.message ?? "Не вдалося підключити оновлення аналітики наживо.",
        );
      }
    });
  return () => {
    void client.removeChannel(channel);
  };
}
