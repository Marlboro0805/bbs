import {
  createApp,
  ref,
  computed,
  onMounted,
} from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
  increment,
  deleteDoc,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyBruI9HbBfAHFBPLJueNOtcHn8cUYdynJU',
  authDomain: 'myapp-8f695.firebaseapp.com',
  projectId: 'myapp-8f695',
  storageBucket: 'myapp-8f695.firebasestorage.app',
  messagingSenderId: '933723574220',
  appId: '1:933723574220:web:ec9775fc4454c13f541769',
  measurementId: 'G-7JVERVKE82',
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

createApp({
  setup() {
    const categories = [
      'すべて',
      '訓練',
      '就活',
      '困りごと',
      '役立ち情報',
      'お守り',
    ];
    const postCategories = categories.filter((cat) => cat !== 'すべて');
    const currentCategory = ref('すべて');
    const threads = ref([]);
    const selectedThread = ref(null);
    const comments = ref([]);

    // 【修正】isPrivateを追加
    const newThread = ref({
      title: '',
      category: '',
      content: '',
      isPrivate: false,
    });
    const newCommentContent = ref('');

    const isAdmin = ref(false);
    const ADMIN_PASSWORD = 'works'; // 管理者パスワード

    onMounted(() => {
      const q = query(collection(db, 'threads'), orderBy('createdAt', 'desc'));
      onSnapshot(q, (snapshot) => {
        const loadedThreads = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          loadedThreads.push({
            id: doc.id,
            ...data,
            createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
          });
        });
        threads.value = loadedThreads;
      });
    });

    // 【修正】非公開スレッドの制御を追加
    const filteredThreads = computed(() => {
      let filtered = threads.value;

      // 1. 管理者モードでない場合は、isPrivateがtrueのものを取り除く
      if (!isAdmin.value) {
        filtered = filtered.filter((t) => !t.isPrivate);
      }

      // 2. カテゴリによる絞り込み
      if (currentCategory.value !== 'すべて') {
        filtered = filtered.filter((t) => t.category === currentCategory.value);
      }

      return filtered;
    });

    const isThreadValid = computed(() => {
      return (
        newThread.value.title.trim() &&
        newThread.value.category &&
        newThread.value.content.trim()
      );
    });

    const parseMarkdown = (text) => {
      if (!text) return '';
      return window.marked.parse(text, { breaks: true });
    };

    const formatDate = (date) => {
      if (!date) return '';
      const d = new Date(date);
      return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };

    // 【修正】保存時に isPrivate の状態も保存する
    const createThread = async () => {
      if (!isThreadValid.value) return;
      const threadData = {
        title: newThread.value.title,
        category: newThread.value.category,
        content: newThread.value.content,
        isPrivate: newThread.value.isPrivate, // ★これを追加
        reactions: { '👍': 0, '💖': 0, '💡': 0, '👀': 0, '🙏': 0, '✨': 0 },
        createdAt: new Date(),
      };
      try {
        await addDoc(collection(db, 'threads'), threadData);
        // リセット処理
        newThread.value = {
          title: '',
          category: '',
          content: '',
          isPrivate: false,
        };
        currentCategory.value = threadData.category;
      } catch (error) {
        console.error('保存エラー:', error);
      }
    };

    const openThread = (thread) => {
      selectedThread.value = thread;
      const q = query(collection(db, 'comments'));
      onSnapshot(q, (snapshot) => {
        const loadedComments = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.threadId === thread.id) {
            loadedComments.push({
              id: doc.id,
              ...data,
              createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
            });
          }
        });
        comments.value = loadedComments.sort(
          (a, b) => a.createdAt - b.createdAt,
        );
      });
    };

    const addComment = async () => {
      if (!newCommentContent.value.trim()) return;
      const commentData = {
        threadId: selectedThread.value.id,
        content: newCommentContent.value,
        createdAt: new Date(),
      };
      try {
        await addDoc(collection(db, 'comments'), commentData);
        newCommentContent.value = '';
      } catch (error) {
        console.error('コメント保存エラー:', error);
      }
    };

    const addReaction = async (threadId, emoji) => {
      try {
        const threadRef = doc(db, 'threads', threadId);
        await updateDoc(threadRef, {
          [`reactions.${emoji}`]: increment(1),
        });
      } catch (error) {
        console.error('リアクション保存エラー:', error);
      }
    };

    const toggleAdmin = () => {
      if (isAdmin.value) {
        isAdmin.value = false;
      } else {
        const input = prompt('管理者の合言葉を入力してください');
        if (input === ADMIN_PASSWORD) {
          isAdmin.value = true;
          alert(
            '管理者モードになりました。非公開スレッドと削除ボタンが表示されます。',
          );
        } else if (input !== null) {
          alert('合言葉が違います。');
        }
      }
    };

    const deleteThread = async (id) => {
      if (
        !confirm(
          '本当にこのスレッドを削除しますか？\n（※スレッドを消しても、中にあるコメントはDB上に残ります）',
        )
      )
        return;
      try {
        await deleteDoc(doc(db, 'threads', id));
      } catch (error) {
        console.error('削除エラー:', error);
      }
    };

    const deleteComment = async (id) => {
      if (!confirm('このコメントを削除しますか？')) return;
      try {
        await deleteDoc(doc(db, 'comments', id));
      } catch (error) {
        console.error('削除エラー:', error);
      }
    };

    return {
      categories,
      postCategories,
      currentCategory,
      threads,
      filteredThreads,
      selectedThread,
      comments,
      newThread,
      newCommentContent,
      isThreadValid,
      isAdmin,
      parseMarkdown,
      formatDate,
      createThread,
      openThread,
      addComment,
      addReaction,
      toggleAdmin,
      deleteThread,
      deleteComment,
    };
  },
}).mount('#app');