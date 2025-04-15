const pool=require("../../shared/rds.js");


exports.getPodCasById= async () => {

    try {
        const [rows] = await pool.query('SELECT * FROM users');
        console.log('Users:', rows);
        return rows;
      } catch (error) {
        console.error('Database query error:', error);
        throw error;
      }
    }