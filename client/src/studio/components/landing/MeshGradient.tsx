import { motion } from "framer-motion";

export function MeshGradient() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      <motion.div
        animate={{ x: [0, 50, 0], y: [0, 30, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 20, repeat: Infinity, repeatType: "reverse" }}
        className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-gradient-to-br from-gray-100 to-transparent rounded-full blur-[100px] opacity-60"
      />
      <motion.div
        animate={{ x: [0, -30, 0], y: [0, 50, 0], scale: [1, 1.2, 1] }}
        transition={{ duration: 25, repeat: Infinity, repeatType: "reverse" }}
        className="absolute -top-[10%] -right-[10%] w-[60%] h-[60%] bg-gradient-to-bl from-blue-50/40 to-transparent rounded-full blur-[120px] opacity-40"
      />
      <motion.div
        animate={{ x: [0, 40, 0], y: [0, -40, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 22, repeat: Infinity, repeatType: "reverse" }}
        className="absolute -bottom-[20%] -left-[10%] w-[50%] h-[50%] bg-gradient-to-tr from-gray-50 to-transparent rounded-full blur-[100px] opacity-50"
      />
    </div>
  );
}
