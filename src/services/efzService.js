import { supabase } from './supabaseClient';

// EFZ Modules
export async function getUserModules(semester = null) {
  let query = supabase
    .from('efz_modules')
    .select('id, module_code, name, semester, created_at')
    .order('module_code', { ascending: true });
  
  if (semester !== null && semester !== undefined) {
    query = query.eq('semester', semester);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function addModule({ module_code, name, semester = 1 }) {
  // Upsert by (user_id, module_code) - unique constraint is on these columns only
  // user_id is auto-filled by handle_user_id trigger from auth.uid()
  const { data, error } = await supabase
    .from('efz_modules')
    .upsert([{ module_code, name, semester }], { onConflict: 'user_id,module_code' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeModule(id) {
  const { error } = await supabase
    .from('efz_modules')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return true;
}

export async function updateModule(id, updates) {
  const { data, error } = await supabase
    .from('efz_modules')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Module grades
export async function getModuleGrades(module_id) {
  const { data, error } = await supabase
    .from('efz_module_grades')
    .select('id, module_id, grade, weight, date, control_name, source, semester, created_at')
    .eq('module_id', module_id)
    .order('date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addModuleGrade({ module_id, grade, weight = 1, date = null, control_name = null, source = 'manual', semester = 1 }) {
  const payload = { module_id, grade, weight, date, control_name, source, semester };
  const { data, error } = await supabase
    .from('efz_module_grades')
    .insert([payload])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeModuleGrade(id) {
  const { error } = await supabase
    .from('efz_module_grades')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return true;
}

// ueK grades
export async function getUekGrades() {
  const { data, error } = await supabase
    .from('efz_uek_grades')
    .select('id, grade, name, date, created_at')
    .order('date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addUekGrade({ grade, name = null, date = null }) {
  const { data, error } = await supabase
    .from('efz_uek_grades')
    .insert([{ grade, name, date }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeUekGrade(id) {
  const { error } = await supabase
    .from('efz_uek_grades')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return true;
}

// IPA
export async function getIpa() {
  const { data, error } = await supabase
    .from('efz_ipa')
    .select('id, grade, is_final, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function setIpa({ grade, is_final = true }) {
  // Ensure single final record: delete existing final then insert
  if (is_final) {
    const { error: delError } = await supabase
      .from('efz_ipa')
      .delete()
      .eq('is_final', true);
    if (delError) throw delError;
  }

  const { data, error } = await supabase
    .from('efz_ipa')
    .insert([{ grade, is_final }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeIpa(id) {
  const { error } = await supabase
    .from('efz_ipa')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return true;
}

export default {
  getUserModules,
  addModule,
  removeModule,
  updateModule,
  getModuleGrades,
  addModuleGrade,
  removeModuleGrade,
  getUekGrades,
  addUekGrade,
  removeUekGrade,
  getIpa,
  setIpa,
  removeIpa
};
