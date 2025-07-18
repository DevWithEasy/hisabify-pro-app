import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import CreateCategoryModal from "../../components/CreateCategoryModal";
import { useStore } from "../../utils/z-store";

export default function Categories() {
  const { db, setDb } = useStore();

  const [categories, setCategories] = useState([]);
  const [filteredCategories, setFilteredCategories] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [editCategory, setEditCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initDB = async () => {
      try {
        const SQLite = await import("expo-sqlite");
        const database = await SQLite.openDatabaseAsync("cashbookbd.db");
        setDb(database);
        await loadCategories(database);
      } catch (error) {
        Toast.show({
          type: "error",
          text1: "Failed to initialize database",
        });
        console.error("Database error:", error);
      } finally {
        setLoading(false);
      }
    };

    if (!db) {
      initDB();
    } else {
      loadCategories(db);
      setLoading(false);
    }
  }, [db, setDb]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = categories.filter((cat) =>
        cat.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredCategories(filtered);
    } else {
      setFilteredCategories(categories);
    }
  }, [searchQuery, categories]);

  const loadCategories = async (database) => {
    try {
      const results = await database.getAllAsync(
        "SELECT * FROM categories ORDER BY name ASC"
      );
      setCategories(results);
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Failed to load categories",
      });
      console.error("Load categories error:", error);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.trim()) {
      Toast.show({
        type: "error",
        text1: "Category name cannot be empty",
      });
      return;
    }

    try {
      const existing = await db.getFirstAsync(
        "SELECT id FROM categories WHERE name = ? LIMIT 1",
        [newCategory]
      );
      if (existing) {
        Toast.show({
          type: "error",
          text1: `"${newCategory}" already exists.`,
        });
        return;
      }

      if (editCategory) {
        if (editCategory.name === "Others") {
          Toast.show({
            type: "error",
            text1: "'Others' category can't be modified",
          });
          return;
        }
        await db.runAsync("UPDATE categories SET name = ? WHERE id = ?", [
          newCategory,
          editCategory.id,
        ]);
        Toast.show({
          type: "success",
          text1: "Category updated",
        });
      } else {
        await db.runAsync(
          "INSERT INTO categories (name, is_default) VALUES (?, ?)",
          [newCategory, false]
        );
        Toast.show({
          type: "success",
          text1: "Category added",
        });
      }

      setModalVisible(false);
      setNewCategory("");
      setEditCategory(null);
      await loadCategories(db);
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Failed to save category",
      });
      console.error("Save error:", error);
    }
  };

  const handleEdit = (cat) => {
    if (cat.name === "Others") {
      Toast.show({
        type: "error",
        text1: "Others' category can't be edited",
      });
      return;
    }
    setEditCategory(cat);
    setNewCategory(cat.name);
    setModalVisible(true);
  };

  const handleDelete = (cat) => {
    if (cat.is_default || cat.name === "Others") {
      Alert.alert("Info", "Default categories can't be deleted.");
      return;
    }
    Alert.alert("Delete Category", `Delete "${cat.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteCategory(cat.id),
      },
    ]);
  };

  const deleteCategory = async (id) => {
    try {
      const others = await db.getFirstAsync(
        "SELECT id FROM categories WHERE name = 'Others'"
      );
      if (!others) {
        Toast.show({
          type: "error",
          text1: "'Others' category not found",
        });
        return;
      }

      await db.runAsync("UPDATE transactions SET cat_id = ? WHERE cat_id = ?", [
        others.id,
        id,
      ]);
      await db.runAsync("DELETE FROM categories WHERE id = ?", [id]);

      Toast.show({
        type: "success",
        text1: "Category deleted successfully",
      });

      await loadCategories(db);
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Failed to delete category",
      });
      console.error("Delete error:", error);
    }
  };

  if (loading || !db) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading categories...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Input */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color="#888" />
        <TextInput
          placeholder="Search categories..."
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Category List */}
      <FlatList
        data={filteredCategories}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ paddingVertical: 12 }}
        renderItem={({ item }) => (
          <View style={styles.categoryItem}>
            <Text style={styles.categoryName}>{item.name}</Text>
            <View style={styles.actions}>
              <TouchableOpacity onPress={() => handleEdit(item)}>
                <Ionicons
                  name="create-outline"
                  size={20}
                  color={item.name === "Others" ? "#ccc" : "#007AFF"}
                />
              </TouchableOpacity>
              {!item.is_default && item.name !== "Others" && (
                <TouchableOpacity onPress={() => handleDelete(item)}>
                  <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Ionicons name="folder-open-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>
              {searchQuery
                ? "No matching categories found"
                : "No categories yet"}
            </Text>
          </View>
        )}
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          setNewCategory("");
          setEditCategory(null);
          setModalVisible(true);
        }}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Modal */}
      <CreateCategoryModal
        modalVisible={modalVisible}
        setModalVisible={setModalVisible}
        newCategory={newCategory}
        setNewCategory={setNewCategory}
        setEditCategory={setEditCategory}
        editCategory={editCategory}
        handleAddCategory={handleAddCategory}
      />
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
    paddingHorizontal: 16,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 8,
  },
  categoryItem: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 0.5,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1f2937",
  },
  actions: {
    flexDirection: "row",
    gap: 16,
  },
  emptyState: {
    alignItems: "center",
    marginTop: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: "#777",
  },
  fab: {
    position: "absolute",
    right: 24,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  loadingText: {
    fontSize: 16,
    color: "#666",
  },
});
