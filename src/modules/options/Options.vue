<template>
  <div>
      <div class="header">
          <img :src="`${publicPath}img/icon38.png`" alt=""/>
          <a>下载管理器</a>
      </div>
    <div class="content">

    </div>
  </div>
</template>

<!--suppress JSUnresolvedVariable, UnterminatedStatementJS -->
<script>
  /* eslint-disable no-undef */
  export default {
  name: 'Options',
  data() {
    return {
      publicPath: process.env.BASE_URL,
    }
  },
  methods: {
  }
}
</script>

<style scoped rel="stylesheet/css">
  .header {
      display: inline-block;
    height: 38px;
  }
  .header a {
    line-height: 38px;
    font-size: 22px;
  }

  .content {
    height: calc(100vh - 38px);
  }
</style>
