import Vue from 'vue'
import Vuex from 'vuex'
import * as types from '../store/types'

Vue.use(Vuex);

const Store = new Vuex.Store({
  state: {
    title: '',
    accept_danger: true,
  },
  mutations: {
    [types.LOGIN]: (state, data) => {
      localStorage.token = data.token;
      state.token = data.token;
      this.state.username = data.username;
      state.role = data.role;
    },
    [types.LOGOUT]: (state) => {
      localStorage.removeItem('token');
      state.token = null;
      state.username = null;
      state.role = null;
    },
    [types.TITLE]: (state, title) => {
      state.title = title;
    }
  }
});

export default Store
