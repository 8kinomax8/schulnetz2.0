import { supabase } from './supabaseClient';

// CRUD service for the subjects table

export async function listSubjects() {
  const { data, error } = await supabase
    .from('subjects')
    .select('id, name, code, created_at')
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function getOrCreateSubject(name, code = null) {
  console.log('📤 subjectService.getOrCreateSubject - checking for subject:', { name, code });

  // Check if the subject already exists for this user
  const { data: existing, error: searchError } = await supabase
    .from('subjects')
    .select('id, name, code')
    .eq('name', name)
    .maybeSingle();

  if (searchError) {
    console.error('❌ subjectService.getOrCreateSubject - search failed:', searchError);
    throw searchError;
  }

  // If it exists, return it
  if (existing) {
    console.log('✅ subjectService.getOrCreateSubject - existing subject found:', existing);
    return existing;
  }

  // Otherwise, create it
  console.log('📝 subjectService.getOrCreateSubject - creating new subject:', { name, code });
  const { data: newSubject, error: insertError } = await supabase
    .from('subjects')
    .insert([{ name, code }])
    .select()
    .single();

  if (insertError) {
    console.error('❌ subjectService.getOrCreateSubject - insert failed:', insertError);
    throw insertError;
  }

  console.log('✅ subjectService.getOrCreateSubject - new subject created:', newSubject);
  return newSubject;
}

export async function deleteSubject(id) {
  const { error } = await supabase
    .from('subjects')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return true;
}
