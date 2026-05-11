import pool from './db.js';

// ============================================
// USERS
// ============================================

export async function upsertUser(cognitoSub, email, displayName, bmType = 'TAL') {
  const connection = await pool.getConnection();
  try {
    const [_result] = await connection.query(
      `INSERT INTO users (cognito_sub, email, display_name, bm_type, last_login)
       VALUES (?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE 
         email = VALUES(email),
         display_name = VALUES(display_name),
         last_login = NOW()`,
      [cognitoSub, email, displayName, bmType]
    );
    
    const [user] = await connection.query(
      'SELECT * FROM users WHERE cognito_sub = ?',
      [cognitoSub]
    );
    
    return user[0];
  } finally {
    connection.release();
  }
}

export async function getUserById(userId) {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );
    return rows[0] || null;
  } finally {
    connection.release();
  }
}

export async function updateUserBmType(userId, bmType) {
  const connection = await pool.getConnection();
  try {
    // Resolve cognito_sub to internal user_id
    const internalUserId = await resolveUserId(connection, userId);
    
    await connection.query(
      'UPDATE users SET bm_type = ? WHERE id = ?',
      [bmType, internalUserId]
    );
    return getUserById(internalUserId);
  } finally {
    connection.release();
  }
}

export async function updateUserCurrentSemester(userId, semester) {
  const connection = await pool.getConnection();
  try {
    // Resolve cognito_sub to internal user_id
    const internalUserId = await resolveUserId(connection, userId);
    
    await connection.query(
      'UPDATE users SET current_semester = ? WHERE id = ?',
      [semester, internalUserId]
    );
    return getUserById(internalUserId);
  } finally {
    connection.release();
  }
}

export async function updateUserMaturanoteGoal(userId, goal) {
  const connection = await pool.getConnection();
  try {
    // Resolve cognito_sub to internal user_id
    const internalUserId = await resolveUserId(connection, userId);
    
    await connection.query(
      'UPDATE users SET maturanote_goal = ? WHERE id = ?',
      [goal, internalUserId]
    );
    return getUserById(internalUserId);
  } finally {
    connection.release();
  }
}

// ============================================
// GRADES
// ============================================

// Helper function to get internal user ID from cognito_sub or id
async function resolveUserId(connection, userIdOrSub) {
  // First try to find by id (UUID format)
  let [users] = await connection.query(
    'SELECT id FROM users WHERE id = ?',
    [userIdOrSub]
  );
  
  if (users.length) return users[0].id;
  
  // Otherwise try to find by cognito_sub
  [users] = await connection.query(
    'SELECT id FROM users WHERE cognito_sub = ?',
    [userIdOrSub]
  );
  
  if (users.length) return users[0].id;
  
  throw new Error(`User not found: ${userIdOrSub}`);
}

export async function addGrade(userId, subjectName, grade, weight, semester, controlName = null, controlDate = null, source = 'manual') {
  const connection = await pool.getConnection();
  try {
    // Resolve cognito_sub to internal user_id
    const internalUserId = await resolveUserId(connection, userId);
    
    // Get subject ID
    const [subjects] = await connection.query(
      'SELECT id FROM subjects WHERE name = ?',
      [subjectName]
    );
    
    if (!subjects.length) {
      throw new Error(`Subject not found: ${subjectName}`);
    }
    
    const subjectId = subjects[0].id;
    
    const [result] = await connection.query(
      `INSERT INTO grades (user_id, subject_id, semester_number, grade, weight, control_name, control_date, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [internalUserId, subjectId, semester, grade, weight, controlName, controlDate, source]
    );
    
    return { id: result.insertId, userId: internalUserId, subjectId, semester, grade, weight };
  } finally {
    connection.release();
  }
}

export async function removeGrade(gradeId) {
  const connection = await pool.getConnection();
  try {
    await connection.query(
      'DELETE FROM grades WHERE id = ?',
      [gradeId]
    );
  } finally {
    connection.release();
  }
}

export async function getUserGrades(userId, semester = null, subjectName = null) {
  const connection = await pool.getConnection();
  try {
    // Resolve cognito_sub to internal user_id
    const internalUserId = await resolveUserId(connection, userId);
    
    let query = `
      SELECT g.id, g.user_id, g.subject_id, s.name AS subject_name, 
             g.semester_number, g.grade, g.weight, g.control_name, 
             g.control_date, g.source, g.created_at
      FROM grades g
      JOIN subjects s ON g.subject_id = s.id
      WHERE g.user_id = ?
    `;
    
    const params = [internalUserId];
    
    if (semester !== null) {
      query += ' AND g.semester_number = ?';
      params.push(semester);
    }
    
    if (subjectName) {
      query += ' AND s.name = ?';
      params.push(subjectName);
    }
    
    query += ' ORDER BY g.control_date DESC';
    
    const [rows] = await connection.query(query, params);
    return rows;
  } finally {
    connection.release();
  }
}

// ============================================
// SEMESTER GRADES
// ============================================

export async function setSemesterGrade(userId, subjectName, semester, grade, isUserSet = false) {
  const connection = await pool.getConnection();
  try {
    // Resolve cognito_sub to internal user_id
    const internalUserId = await resolveUserId(connection, userId);
    
    const [subjects] = await connection.query(
      'SELECT id FROM subjects WHERE name = ?',
      [subjectName]
    );
    
    if (!subjects.length) {
      throw new Error(`Subject not found: ${subjectName}`);
    }
    
    const subjectId = subjects[0].id;
    
    await connection.query(
      `INSERT INTO semester_grades (user_id, subject_id, semester_number, grade, source, is_final)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
         grade = VALUES(grade),
         source = VALUES(source),
         is_final = VALUES(is_final),
         updated_at = NOW()`,
      [internalUserId, subjectId, semester, grade, isUserSet ? 'manual' : 'calculated', isUserSet]
    );
    
    return { userId: internalUserId, subjectId, semester, grade };
  } finally {
    connection.release();
  }
}

export async function getUserSemesterGrades(userId, semester = null) {
  const connection = await pool.getConnection();
  try {
    // Resolve cognito_sub to internal user_id
    const internalUserId = await resolveUserId(connection, userId);
    
    let query = `
      SELECT sg.id, sg.user_id, sg.subject_id, s.name AS subject_name,
             sg.semester_number, sg.grade, sg.is_final, sg.source
      FROM semester_grades sg
      JOIN subjects s ON sg.subject_id = s.id
      WHERE sg.user_id = ?
    `;
    
    const params = [internalUserId];
    
    if (semester !== null) {
      query += ' AND sg.semester_number = ?';
      params.push(semester);
    }
    
    query += ' ORDER BY sg.semester_number, s.name';
    
    const [rows] = await connection.query(query, params);
    return rows;
  } finally {
    connection.release();
  }
}

// ============================================
// SEMESTER PLANS (Planned Controls)
// ============================================

export async function addSemesterPlan(userId, subjectName, semester, plannedGrade, weight, description = null) {
  const connection = await pool.getConnection();
  try {
    // Resolve cognito_sub to internal user_id
    const internalUserId = await resolveUserId(connection, userId);
    
    const [subjects] = await connection.query(
      'SELECT id FROM subjects WHERE name = ?',
      [subjectName]
    );
    
    if (!subjects.length) {
      throw new Error(`Subject not found: ${subjectName}`);
    }
    
    const subjectId = subjects[0].id;
    
    const [result] = await connection.query(
      `INSERT INTO semester_plans (user_id, subject_id, semester_number, planned_grade, weight, description)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [internalUserId, subjectId, semester, plannedGrade, weight, description]
    );
    
    return { id: result.insertId, userId: internalUserId, subjectId, semester, plannedGrade, weight };
  } finally {
    connection.release();
  }
}

export async function removeSemesterPlan(planId) {
  const connection = await pool.getConnection();
  try {
    await connection.query(
      'DELETE FROM semester_plans WHERE id = ?',
      [planId]
    );
  } finally {
    connection.release();
  }
}

export async function getUserSemesterPlans(userId, semester = null) {
  const connection = await pool.getConnection();
  try {
    // Resolve cognito_sub to internal user_id
    const internalUserId = await resolveUserId(connection, userId);
    
    let query = `
      SELECT sp.id, sp.user_id, sp.subject_id, s.name AS subject_name,
             sp.semester_number, sp.planned_grade, sp.weight, sp.description
      FROM semester_plans sp
      JOIN subjects s ON sp.subject_id = s.id
      WHERE sp.user_id = ?
    `;
    
    const params = [internalUserId];
    
    if (semester !== null) {
      query += ' AND sp.semester_number = ?';
      params.push(semester);
    }
    
    query += ' ORDER BY sp.semester_number, s.name';
    
    const [rows] = await connection.query(query, params);
    return rows;
  } finally {
    connection.release();
  }
}

// ============================================
// SUBJECT GOALS
// ============================================

export async function setSubjectGoal(userId, subjectName, targetGrade) {
  const connection = await pool.getConnection();
  try {
    // Resolve cognito_sub to internal user_id
    const internalUserId = await resolveUserId(connection, userId);
    
    const [subjects] = await connection.query(
      'SELECT id FROM subjects WHERE name = ?',
      [subjectName]
    );
    
    if (!subjects.length) {
      throw new Error(`Subject not found: ${subjectName}`);
    }
    
    const subjectId = subjects[0].id;
    
    await connection.query(
      `INSERT INTO subject_goals (user_id, subject_id, target_grade)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE 
         target_grade = VALUES(target_grade),
         updated_at = NOW()`,
      [internalUserId, subjectId, targetGrade]
    );
    
    return { userId: internalUserId, subjectId, targetGrade };
  } finally {
    connection.release();
  }
}

export async function removeSubjectGoal(userId, subjectName) {
  const connection = await pool.getConnection();
  try {
    // Resolve cognito_sub to internal user_id
    const internalUserId = await resolveUserId(connection, userId);
    
    const [subjects] = await connection.query(
      'SELECT id FROM subjects WHERE name = ?',
      [subjectName]
    );
    
    if (!subjects.length) return;
    
    const subjectId = subjects[0].id;
    
    await connection.query(
      'DELETE FROM subject_goals WHERE user_id = ? AND subject_id = ?',
      [internalUserId, subjectId]
    );
  } finally {
    connection.release();
  }
}

export async function getUserSubjectGoals(userId) {
  const connection = await pool.getConnection();
  try {
    // Resolve cognito_sub to internal user_id
    const internalUserId = await resolveUserId(connection, userId);
    
    const [rows] = await connection.query(
      `SELECT sg.id, sg.user_id, sg.subject_id, s.name AS subject_name, sg.target_grade
       FROM subject_goals sg
       JOIN subjects s ON sg.subject_id = s.id
       WHERE sg.user_id = ?
       ORDER BY s.name`,
      [internalUserId]
    );
    return rows;
  } finally {
    connection.release();
  }
}

// ============================================
// EXAM SIMULATOR
// ============================================

export async function setExamGrade(userId, subjectName, simulatedGrade) {
  const connection = await pool.getConnection();
  try {
    // Resolve cognito_sub to internal user_id
    const internalUserId = await resolveUserId(connection, userId);
    
    const [subjects] = await connection.query(
      'SELECT id FROM subjects WHERE name = ?',
      [subjectName]
    );
    
    if (!subjects.length) {
      throw new Error(`Subject not found: ${subjectName}`);
    }
    
    const subjectId = subjects[0].id;
    
    await connection.query(
      `INSERT INTO exam_simulator (user_id, subject_id, simulated_grade)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE 
         simulated_grade = VALUES(simulated_grade),
         updated_at = NOW()`,
      [internalUserId, subjectId, simulatedGrade]
    );
    
    return { userId: internalUserId, subjectId, simulatedGrade };
  } finally {
    connection.release();
  }
}

export async function removeExamGrade(userId, subjectName) {
  const connection = await pool.getConnection();
  try {
    // Resolve cognito_sub to internal user_id
    const internalUserId = await resolveUserId(connection, userId);
    
    const [subjects] = await connection.query(
      'SELECT id FROM subjects WHERE name = ?',
      [subjectName]
    );
    
    if (!subjects.length) return;
    
    const subjectId = subjects[0].id;
    
    await connection.query(
      'DELETE FROM exam_simulator WHERE user_id = ? AND subject_id = ?',
      [internalUserId, subjectId]
    );
  } finally {
    connection.release();
  }
}

export async function getUserExamGrades(userId) {
  const connection = await pool.getConnection();
  try {
    // Resolve cognito_sub to internal user_id
    const internalUserId = await resolveUserId(connection, userId);
    
    const [rows] = await connection.query(
      `SELECT es.id, es.user_id, es.subject_id, s.name AS subject_name, es.simulated_grade
       FROM exam_simulator es
       JOIN subjects s ON es.subject_id = s.id
       WHERE es.user_id = ?
       ORDER BY s.name`,
      [internalUserId]
    );
    return rows;
  } finally {
    connection.release();
  }
}

// ============================================
// SUBJECTS
// ============================================

export async function getAllSubjects() {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query(
      'SELECT id, name, bm_type FROM subjects ORDER BY name'
    );
    return rows;
  } finally {
    connection.release();
  }
}

export async function getSubjectsByBmType(bmType) {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query(
      `SELECT id, name, bm_type FROM subjects 
       WHERE bm_type = ? OR bm_type = 'BOTH'
       ORDER BY name`,
      [bmType]
    );
    return rows;
  } finally {
    connection.release();
  }
}
