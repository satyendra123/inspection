import UserLog from '../Model/Userlog.js';
import User from '../Model/User.js';

class UserController {

  // Fetch all user logs
  static getalldata = async (req, res) => {
    try {
      const userlog = await UserLog.findAll();
      res.status(200).json(userlog);
    } catch (error) {
      console.error("Error fetching user logs:", error);
      res.status(500).json({ error: "Failed to fetch user logs" });
    }
  };
}

export default UserController;
