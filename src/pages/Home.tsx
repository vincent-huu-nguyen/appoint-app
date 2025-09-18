import { Link } from "react-router-dom";

const Home = () => {
  return (
    <div className="flex flex-col items-center justify-start min-h-screen pt-16 bg-gray-100 text-center px-4">
      {/* Giant logo */}
      <div className="text-[15rem] font-extrabold text-gray-800 select-none leading-none pointer-events-none">
        A<span className="text-indigo-600">.</span>
      </div>

      <h1 className="text-4xl font-bold mb-2">Welcome to the Appoint App</h1>
      <p className="text-gray-600 mb-8">A Point in Time, Made Easy</p>
      <div className="flex gap-4">
        <Link to="/login" className="bg-gray-800 text-white px-6 py-2 rounded hover:bg-gray-900 transition">
          Login
        </Link>
        <Link to="/register" className="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700 transition">
          Registe
        </Link>
      </div>
    </div>
  );
};

export default Home;
