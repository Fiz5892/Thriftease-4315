import { useNavigate } from "@remix-run/react"; // Import useNavigate

function TentangKamiPage() {
  const navigate = useNavigate(); // Initialize useNavigate

  return (
    <div className="flex flex-col items-center min-h-screen bg-white">
      <header className="relative flex items-center justify-between border-b pb-2 lg:pb-4 mb-4 lg:mb-6 w-full px-4 lg:px-8 bg-white pt-4">
      <button
          onClick={() => navigate(-1)} // Navigate ke halaman sebelumnya
          className="w-8 h-8 lg:w-10 lg:h-10 bg-yellow-300 rounded-full flex items-center justify-center"
        >
          <i className="fas fa-arrow-left"></i>
        </button>
        <h1 className="absolute left-1/2 transform -translate-x-1/2 text-xl lg:text-2xl font-bold">
          Tentang Kami
        </h1>
      </header>
      <div className="space-y-4 ">
        <a
          href="https://www.instagram.com/4315_thrift"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center p-4 border-gray-300 border-2 rounded-lg shadow-xl mt-6 mr-6 ml-6 lg:m-0"
        >
          <i className="fab fa-instagram text-3xl text-pink-500"></i>
          <span className="ml-4 text-lg text-gray-800">4315_thrift</span>
        </a>
        <a
          href="https://wa.me/08123456789"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center p-4 border-gray-300 border-2 rounded-lg shadow-xl m-6 lg:m-0"
        >
          <i className="fab fa-whatsapp text-3xl text-green-500"></i>
          <span className="ml-4 text-lg text-gray-800">08123456789</span>
        </a>
        <a
          href="https://www.facebook.com/4315_thrift"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center p-4 border-gray-300 border-2 rounded-lg shadow-xl m-6 lg:m-0"
        >
          <i className="fab fa-facebook text-3xl text-blue-500"></i>
          <span className="ml-4 text-lg text-gray-800">4315_thrift</span>
        </a>
        <div className="border-gray-300 border-2 rounded-lg overflow-hidden shadow-xl m-6 lg:m-0">
          <iframe
            title="Map of 4315_thrift location" // Add a descriptive title here
            src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d3054.5703665924084!2d112.61646531532926!3d-7.964737657114649!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e788358f1d98d6b%3A0x65aa3c3cc2aa24ca!2sThriftsecondbranded%204315_thrift!5e1!3m2!1sen!2sid!4v1730825150749!5m2!1sen!2sid"
            width="100%"
            className="h-[200px] lg:h-[350px]"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className="p-4">
            <p className="text-gray-800">
              <i className="fas fa-map-marker-alt text-yellow-300 mr-4"></i>
              Jl. Terusan Surabaya No.2, Sumberjo, Gading Kasri, Kec. Klojen,
              Kota Malang, Jawa Timur 65115
            </p>
          </div>
        </div>
        <div></div>
      </div>
    </div>
  );
}

export default TentangKamiPage;
