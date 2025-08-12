import { Link } from "react-router-dom";

const Home = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 text-center px-4">
      <h1 className="text-4xl font-bold mb-6">Welcome to the Appoint App</h1>
      <p className="text-gray-600 mb-10">Please login or register to continue</p>
      <div className="flex gap-4">
        <Link
          to="/login"
          className="bg-gray-800 text-white px-6 py-2 rounded hover:bg-gray-900 transition"
        >
          Login
        </Link>
        <Link
          to="/register"
          className="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700 transition"
        >
          Register
        </Link>
      </div>
    </div>
  );
};

export default Home;
