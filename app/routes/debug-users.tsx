import { useState, useEffect } from "react";

type User = {
  id: number;
  username: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  password?: string;
};

const UserManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState<{
    id: number | null;
    username: string;
    email: string;
    fullName: string;
    phoneNumber: string;
    password: string;
  }>({
    id: null,
    username: "",
    email: "",
    fullName: "",
    phoneNumber: "",
    password: "",
  });

  const fetchUsers = async () => {
    const response = await fetch("/api/users");
    const data = await response.json();
    setUsers(data);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const method = form.id ? "PUT" : "POST";
    const response = await fetch("/api/users", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (response.ok) {
      fetchUsers();
      setForm({ id: null, username: "", email: "", fullName: "", phoneNumber: "", password: "" });
    }
  };

  const handleEdit = (user: {
    id: number | null;
    username: string;
    email: string;
    fullName: string;
    phoneNumber: string;
    password?: string;
  }) => {
    setForm({
      ...user,
      password: user.password ?? "",
    });
  };

  const handleDelete = async (id: number) => {
    await fetch("/api/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchUsers();
  };

  return (
    <div>
      <h1>User Management</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          name="username"
          placeholder="Username"
          value={form.username}
          onChange={handleInputChange}
          required
        />
        <input
          type="email"
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={handleInputChange}
          required
        />
        <input
          type="text"
          name="fullName"
          placeholder="Full Name"
          value={form.fullName}
          onChange={handleInputChange}
        />
        <input
          type="text"
          name="phoneNumber"
          placeholder="Phone Number"
          value={form.phoneNumber}
          onChange={handleInputChange}
        />
        {!form.id && (
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={form.password}
            onChange={handleInputChange}
            required
          />
        )}
        <button type="submit">{form.id ? "Update" : "Create"}</button>
      </form>

      <ul>
        {users.map((user) => (
          <li key={user.id}>
            <span>{user.username}</span>
            <button onClick={() => handleEdit(user)}>Edit</button>
            <button onClick={() => handleDelete(user.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default UserManagement;
