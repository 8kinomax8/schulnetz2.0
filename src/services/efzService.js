import { supabase } from './supabaseClient';

const ALLOWED_MODULE_UPDATE_KEYS = new Set(['module_code', 'name', 'semester']);
const MAX_TEXT_LENGTH = 200;

const sanitizeText = (value, maxLength = MAX_TEXT_LENGTH) => {
  if (value === null || value === undefined) return null;
  return String(value)
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0);
      return (code < 32 || code === 127) ? ' ' : char;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
};

const sanitizeModuleCode = (value) => {
  const code = sanitizeText(value, 16)?.toUpperCase() || '';
  if (!/^[A-Z0-9]{1,8}$/.test(code)) {
    throw new Error('Invalid EFZ module code');
  }
  return code;
};

const sanitizeGrade = (value) => {
  const grade = Number(value);
  if (!Number.isFinite(grade) || grade < 1 || grade > 6) {
    throw new Error('Invalid grade');
  }
  return grade;
};

const sanitizeWeight = (value) => {
  const weight = Number(value ?? 1);
  if (!Number.isFinite(weight) || weight <= 0 || weight > 100) {
    throw new Error('Invalid weight');
  }
  return weight;
};

const sanitizeSemester = (value) => {
  const semester = Number.parseInt(value, 10);
  if (!Number.isFinite(semester) || semester < 1 || semester > 8) {
    throw new Error('Invalid semester');
  }
  return semester;
};

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
  const payload = {
    module_code: sanitizeModuleCode(module_code),
    name: sanitizeText(name),
    semester: sanitizeSemester(semester)
  };

  // Upsert by (user_id, module_code) - unique constraint is on these columns only
  // user_id is auto-filled by handle_user_id trigger from auth.uid()
  const { data, error } = await supabase
    .from('efz_modules')
    .upsert([payload], { onConflict: 'user_id,module_code' })
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
  const payload = Object.fromEntries(
    Object.entries(updates || {}).filter(([key]) => ALLOWED_MODULE_UPDATE_KEYS.has(key))
  );

  if ('module_code' in payload) payload.module_code = sanitizeModuleCode(payload.module_code);
  if ('name' in payload) payload.name = sanitizeText(payload.name);
  if ('semester' in payload) payload.semester = sanitizeSemester(payload.semester);
  if (Object.keys(payload).length === 0) return null;

  const { data, error } = await supabase
    .from('efz_modules')
    .update(payload)
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
  const payload = {
    module_id,
    grade: sanitizeGrade(grade),
    weight: sanitizeWeight(weight),
    date: date || null,
    control_name: sanitizeText(control_name),
    source: ['manual', 'simulated', 'import', 'computed'].includes(source) ? source : 'manual',
    semester: sanitizeSemester(semester)
  };
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
    .insert([{ grade: sanitizeGrade(grade), name: sanitizeText(name), date: date || null }])
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
  const sanitizedGrade = sanitizeGrade(grade);

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
    .insert([{ grade: sanitizedGrade, is_final: Boolean(is_final) }])
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
