import { supabase } from './supabaseClient';

// CRUD service for the grades table
// Expected columns: id, user_id, subject_id (optional), semester_number, grade, weight, date, control_name, source, created_at
// We never pass user_id directly: policies and triggers rely on auth.uid();

export async function listGrades() {
  const { data, error } = await supabase
    .from('grades')
    .select('id, subject_id, semester_number, grade, weight, date, control_name, source, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addGrade({ subject_id = null, semester_number, grade, weight = 1, date = null, control_name = null, source = null }) {
  const payload = { subject_id, semester_number, grade, weight, date, control_name, source };
  console.log('📤 gradeService.addGrade - preparing insert:', payload);

  const { data, error } = await supabase
    .from('grades')
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error('❌ gradeService.addGrade - insert failed:', { error: error.message, code: error.code, details: error.details });
    throw error;
  }

  console.log('✅ gradeService.addGrade - insert successful:', data);
  return data;
}

export async function updateGrade(id, fields) {
  const { data, error } = await supabase
    .from('grades')
    .update(fields)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteGrade(id) {
  const { error } = await supabase
    .from('grades')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return true;
}
